import { detectPitch } from '../pitch/detect';

// Mic input singleton (docs/09-improvement-plan.md §16.3), mirroring
// lib/audio/engine.ts's shape (status getter + subscribe, framework-free).
// requestMic() must be called from a user gesture (03-audio-engine.md §4
// applies to input too) and reuses whatever AudioContext the caller already
// has unlocked (engine.ts's shared one), rather than opening a second one.
//
// Uses an AudioWorkletNode as the primary capture mechanism, falling back
// to a ScriptProcessorNode only when AudioWorklet isn't available (old
// Safari) — an earlier draft used ScriptProcessorNode unconditionally,
// reasoning it "only carries a deprecation warning, not a functional gap";
// that turned out to be wrong once browsers actually finished removing it
// (`audioCtx.createScriptProcessor is not a function`). Detection itself
// still runs on the main thread either way (the worklet only forwards raw
// Float32 frames via postMessage) — cheap enough at 20-30fps per the plan.
export type MicStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'error';

export interface MicFrame {
  frequency: number | null;
  clarity: number;
  rms: number;
}

/** Analysis window size in samples — callers use this + the AudioContext's sampleRate to know each frame's real-world duration. */
export const MIC_BUFFER_SIZE = 2048;
const BUFFER_SIZE = MIC_BUFFER_SIZE;
const WORKLET_PROCESSOR_NAME = 'pitch-capture-processor';

let status: MicStatus = 'idle';
let lastError: string | null = null;
let stream: MediaStream | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let workletNode: AudioWorkletNode | null = null;
let processorNode: ScriptProcessorNode | null = null;
let sinkNode: GainNode | null = null;
const statusListeners = new Set<() => void>();
const frameListeners = new Set<(frame: MicFrame) => void>();

function notifyStatus(): void {
  statusListeners.forEach((fn) => fn());
}

function computeRms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i]! * buffer[i]!;
  return Math.sqrt(sum / buffer.length);
}

function processBuffer(ctx: BaseAudioContext, buffer: Float32Array): void {
  const rms = computeRms(buffer);
  const result = detectPitch(buffer, ctx.sampleRate);
  const frame: MicFrame = { frequency: result?.frequency ?? null, clarity: result?.clarity ?? 0, rms };
  frameListeners.forEach((fn) => fn(frame));
}

function isPermissionDenied(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
}

async function connectViaWorklet(ctx: AudioContext): Promise<void> {
  const workletUrl = new URL('./pitch-capture-worklet.js', import.meta.url);
  await ctx.audioWorklet.addModule(workletUrl);
  const node = new AudioWorkletNode(ctx, WORKLET_PROCESSOR_NAME, {
    processorOptions: { bufferSize: BUFFER_SIZE },
  });
  node.port.onmessage = (event: MessageEvent<Float32Array>) => processBuffer(ctx, event.data);
  workletNode = node;
  sourceNode!.connect(node);
  // A worklet node still needs to reach a destination to keep processing in
  // some browsers — route through a muted gain so the raw mic input is
  // never audibly monitored (feedback risk) while still firing.
  sinkNode = ctx.createGain();
  sinkNode.gain.value = 0;
  node.connect(sinkNode);
  sinkNode.connect(ctx.destination);
}

function connectViaScriptProcessor(ctx: AudioContext): void {
  const node = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
  node.onaudioprocess = (event) => processBuffer(ctx, event.inputBuffer.getChannelData(0));
  processorNode = node;
  sourceNode!.connect(node);
  sinkNode = ctx.createGain();
  sinkNode.gain.value = 0;
  node.connect(sinkNode);
  sinkNode.connect(ctx.destination);
}

export const mic = {
  get status(): MicStatus {
    return status;
  },
  get lastError(): string | null {
    return lastError;
  },
  subscribe(fn: () => void): () => void {
    statusListeners.add(fn);
    return () => statusListeners.delete(fn);
  },
  /** Registers a callback for each ~BUFFER_SIZE-sample analysis frame while the mic is open. */
  onFrame(fn: (frame: MicFrame) => void): () => void {
    frameListeners.add(fn);
    return () => frameListeners.delete(fn);
  },
  async requestMic(ctx: BaseAudioContext): Promise<void> {
    if (status === 'ready' || status === 'requesting') return;
    status = 'requesting';
    lastError = null;
    notifyStatus();
    try {
      // echoCancellation/noiseSuppression/autoGainControl all off — voice
      // processing meant for calls distorts pitch (§16.3).
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const audioCtx = ctx as AudioContext;
      sourceNode = audioCtx.createMediaStreamSource(stream);
      if (audioCtx.audioWorklet) {
        await connectViaWorklet(audioCtx);
      } else if (typeof audioCtx.createScriptProcessor === 'function') {
        connectViaScriptProcessor(audioCtx);
      } else {
        throw new Error('This browser does not support microphone capture (no AudioWorklet or ScriptProcessorNode).');
      }
      status = 'ready';
    } catch (err) {
      status = isPermissionDenied(err) ? 'denied' : 'error';
      if (status === 'error') lastError = err instanceof Error ? err.message : String(err);
    } finally {
      notifyStatus();
    }
  },
  stopMic(): void {
    if (workletNode) {
      workletNode.port.onmessage = null;
      workletNode.disconnect();
      workletNode = null;
    }
    if (processorNode) {
      processorNode.onaudioprocess = null;
      processorNode.disconnect();
      processorNode = null;
    }
    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode = null;
    }
    if (sinkNode) {
      sinkNode.disconnect();
      sinkNode = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    status = 'idle';
    notifyStatus();
  },
};
