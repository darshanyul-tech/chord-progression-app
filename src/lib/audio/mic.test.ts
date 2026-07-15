import { afterEach, describe, expect, it, vi } from 'vitest';
import { mic, type MicFrame } from './mic';

function fakeStream() {
  const track = { stop: vi.fn() };
  return { getTracks: () => [track] } as unknown as MediaStream;
}

class FakeAudioWorkletNode {
  static lastInstance: FakeAudioWorkletNode | null = null;
  port: { onmessage: ((e: MessageEvent<Float32Array>) => void) | null } = { onmessage: null };
  connect = vi.fn();
  disconnect = vi.fn();
  constructor(
    public ctx: unknown,
    public name: string,
    public options: unknown,
  ) {
    FakeAudioWorkletNode.lastInstance = this;
  }
}

function fakeAudioContext(opts: { withWorklet?: boolean; withScriptProcessor?: boolean } = {}) {
  const { withWorklet = true, withScriptProcessor = true } = opts;
  const sourceNode = { connect: vi.fn(), disconnect: vi.fn() };
  const gainNode = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
  const scriptProcessorNode: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onaudioprocess: ((e: AudioProcessingEvent) => void) | null } = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
  };
  const ctx: Record<string, unknown> = {
    sampleRate: 44100,
    destination: {},
    createMediaStreamSource: vi.fn(() => sourceNode),
    createGain: vi.fn(() => gainNode),
  };
  if (withWorklet) {
    ctx.audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
  }
  if (withScriptProcessor) {
    ctx.createScriptProcessor = vi.fn(() => scriptProcessorNode);
  }
  return { ctx: ctx as unknown as AudioContext, sourceNode, gainNode, scriptProcessorNode };
}

function makeSine(freq: number, sampleRate: number, length: number): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) buf[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return buf;
}

describe('mic', () => {
  afterEach(() => {
    mic.stopMic();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeAudioWorkletNode.lastInstance = null;
  });

  it('starts idle', () => {
    expect(mic.status).toBe('idle');
  });

  it('requestMic() prefers AudioWorkletNode when audioWorklet is available, and wires it up', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    const { ctx, sourceNode, gainNode } = fakeAudioContext();

    const seen: string[] = [];
    mic.subscribe(() => seen.push(mic.status));
    const p = mic.requestMic(ctx);
    expect(mic.status).toBe('requesting');
    await p;

    expect(mic.status).toBe('ready');
    expect((ctx.audioWorklet as { addModule: ReturnType<typeof vi.fn> }).addModule).toHaveBeenCalled();
    const node = FakeAudioWorkletNode.lastInstance!;
    expect(node.name).toBe('pitch-capture-processor');
    expect(sourceNode.connect).toHaveBeenCalledWith(node);
    expect(node.connect).toHaveBeenCalledWith(gainNode);
    expect(gainNode.gain.value).toBe(0); // muted sink — never audibly monitored
    expect(seen).toEqual(['requesting', 'ready']);
  });

  it('falls back to ScriptProcessorNode when AudioWorklet is unavailable (old Safari)', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    const { ctx, sourceNode, scriptProcessorNode } = fakeAudioContext({ withWorklet: false });

    await mic.requestMic(ctx);

    expect(mic.status).toBe('ready');
    expect(sourceNode.connect).toHaveBeenCalledWith(scriptProcessorNode);
  });

  it('sets status to "error" when neither AudioWorklet nor ScriptProcessorNode is available', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    const { ctx } = fakeAudioContext({ withWorklet: false, withScriptProcessor: false });

    await mic.requestMic(ctx);

    expect(mic.status).toBe('error');
    expect(mic.lastError).toMatch(/does not support microphone capture/);
  });

  it('sets status to "denied" when getUserMedia rejects with a permission error', async () => {
    const denied = Object.assign(new DOMException('no', 'NotAllowedError'));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(denied) } });
    await mic.requestMic(fakeAudioContext().ctx);
    expect(mic.status).toBe('denied');
    expect(mic.lastError).toBeNull();
  });

  it('sets status to "error" and records lastError for any other failure (e.g. no mic device)', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error('Requested device not found')) },
    });
    await mic.requestMic(fakeAudioContext().ctx);
    expect(mic.status).toBe('error');
    expect(mic.lastError).toBe('Requested device not found');
  });

  it('is a no-op once already ready (getUserMedia is not called again)', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream());
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    await mic.requestMic(fakeAudioContext().ctx);
    await mic.requestMic(fakeAudioContext().ctx);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('onFrame delivers frequency/clarity/rms from AudioWorklet frames', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    const { ctx } = fakeAudioContext();
    await mic.requestMic(ctx);

    const frames: MicFrame[] = [];
    mic.onFrame((f) => frames.push(f));

    const sine = makeSine(220, ctx.sampleRate, 2048);
    FakeAudioWorkletNode.lastInstance!.port.onmessage!({ data: sine } as MessageEvent<Float32Array>);

    expect(frames).toHaveLength(1);
    expect(frames[0]!.frequency).not.toBeNull();
    expect(Math.abs(1200 * Math.log2(frames[0]!.frequency! / 220))).toBeLessThan(5);
    expect(frames[0]!.rms).toBeGreaterThan(0);
  });

  it('onFrame delivers frequency/clarity/rms from the ScriptProcessorNode fallback', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    const { ctx, scriptProcessorNode } = fakeAudioContext({ withWorklet: false });
    await mic.requestMic(ctx);

    const frames: MicFrame[] = [];
    mic.onFrame((f) => frames.push(f));

    const sine = makeSine(220, ctx.sampleRate, 2048);
    scriptProcessorNode.onaudioprocess!({ inputBuffer: { getChannelData: () => sine } } as unknown as AudioProcessingEvent);

    expect(frames).toHaveLength(1);
    expect(frames[0]!.frequency).not.toBeNull();
  });

  it('onFrame unsubscribe stops delivering further frames', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    const { ctx } = fakeAudioContext();
    await mic.requestMic(ctx);

    const frames: MicFrame[] = [];
    const unsubscribe = mic.onFrame((f) => frames.push(f));
    unsubscribe();

    const sine = makeSine(220, ctx.sampleRate, 2048);
    FakeAudioWorkletNode.lastInstance!.port.onmessage!({ data: sine } as MessageEvent<Float32Array>);
    expect(frames).toHaveLength(0);
  });

  it('stopMic() disconnects everything, stops the media stream tracks, and resets to idle', async () => {
    const stream = fakeStream();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    const { ctx, sourceNode, gainNode } = fakeAudioContext();
    await mic.requestMic(ctx);
    const node = FakeAudioWorkletNode.lastInstance!;

    mic.stopMic();

    expect(mic.status).toBe('idle');
    expect(sourceNode.disconnect).toHaveBeenCalled();
    expect(node.disconnect).toHaveBeenCalled();
    expect(gainNode.disconnect).toHaveBeenCalled();
    expect((stream.getTracks()[0] as unknown as { stop: ReturnType<typeof vi.fn> }).stop).toHaveBeenCalled();
  });

  it('subscribe() returns a working unsubscribe function', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    const listener = vi.fn();
    const unsubscribe = mic.subscribe(listener);
    unsubscribe();
    await mic.requestMic(fakeAudioContext().ctx);
    expect(listener).not.toHaveBeenCalled();
  });
});
