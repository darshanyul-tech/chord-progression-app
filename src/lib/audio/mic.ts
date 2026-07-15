import { detectPitch } from '../pitch/detect';

// Mic input singleton (docs/09-improvement-plan.md §16.3), mirroring
// lib/audio/engine.ts's shape (status getter + subscribe, framework-free).
// requestMic() must be called from a user gesture (03-audio-engine.md §4
// applies to input too) and reuses whatever AudioContext the caller already
// has unlocked (engine.ts's shared one), rather than opening a second one.
//
// Uses a ScriptProcessorNode rather than an AudioWorkletNode for v1: both
// work correctly in every current browser (ScriptProcessorNode only carries
// a deprecation *warning*, not a functional gap), and it avoids needing a
// separate worklet module asset wired through Vite's asset-URL pipeline for
// what the plan itself notes is cheap enough to run on the main thread
// either way ("no need to run detection inside the worklet for v1").
// Revisit only if main-thread jank actually becomes a measured problem.
export type MicStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'error';

export interface MicFrame {
  frequency: number | null;
  clarity: number;
  rms: number;
}

/** Analysis window size in samples — callers use this + the AudioContext's sampleRate to know each frame's real-world duration. */
export const MIC_BUFFER_SIZE = 2048;
const BUFFER_SIZE = MIC_BUFFER_SIZE;

let status: MicStatus = 'idle';
let lastError: string | null = null;
let stream: MediaStream | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
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

function handleAudioProcess(ctx: BaseAudioContext, event: AudioProcessingEvent): void {
  const input = event.inputBuffer.getChannelData(0);
  const rms = computeRms(input);
  const result = detectPitch(input, ctx.sampleRate);
  const frame: MicFrame = { frequency: result?.frequency ?? null, clarity: result?.clarity ?? 0, rms };
  frameListeners.forEach((fn) => fn(frame));
}

function isPermissionDenied(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
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
      processorNode = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorNode.onaudioprocess = (event) => handleAudioProcess(ctx, event);
      sourceNode.connect(processorNode);
      // A ScriptProcessorNode must reach a destination to fire onaudioprocess
      // in some browsers — route through a muted gain so the raw mic input
      // is never audibly monitored (feedback risk) while still firing.
      sinkNode = audioCtx.createGain();
      sinkNode.gain.value = 0;
      processorNode.connect(sinkNode);
      sinkNode.connect(audioCtx.destination);
      status = 'ready';
    } catch (err) {
      status = isPermissionDenied(err) ? 'denied' : 'error';
      if (status === 'error') lastError = err instanceof Error ? err.message : String(err);
    } finally {
      notifyStatus();
    }
  },
  stopMic(): void {
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
