import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Tone from 'tone';
import { mic, type MicFrame } from './mic';

vi.mock('tone', async (importOriginal) => {
  const actual = await importOriginal<typeof import('tone')>();
  return { ...actual, getContext: vi.fn() };
});

function fakeStream() {
  const track = { stop: vi.fn() };
  return { getTracks: () => [track] } as unknown as MediaStream;
}

class FakeWorkletNode {
  static lastInstance: FakeWorkletNode | null = null;
  port: { onmessage: ((e: MessageEvent<Float32Array>) => void) | null } = { onmessage: null };
  connect = vi.fn();
  disconnect = vi.fn();
  constructor() {
    FakeWorkletNode.lastInstance = this;
  }
}

function fakeToneContext(opts: { addModuleRejects?: unknown } = {}) {
  return {
    addAudioWorkletModule: opts.addModuleRejects
      ? vi.fn().mockRejectedValue(opts.addModuleRejects)
      : vi.fn().mockResolvedValue(undefined),
    createAudioWorkletNode: vi.fn(() => new FakeWorkletNode()),
  };
}

function fakeAudioContext() {
  const sourceNode = { connect: vi.fn(), disconnect: vi.fn() };
  const gainNode = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
  const ctx = {
    sampleRate: 44100,
    destination: {},
    createMediaStreamSource: vi.fn(() => sourceNode),
    createGain: vi.fn(() => gainNode),
  };
  return { ctx: ctx as unknown as AudioContext, sourceNode, gainNode };
}

function makeSine(freq: number, sampleRate: number, length: number): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) buf[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return buf;
}

describe('mic', () => {
  beforeEach(() => {
    vi.mocked(Tone.getContext).mockReturnValue(fakeToneContext() as unknown as ReturnType<typeof Tone.getContext>);
  });

  afterEach(() => {
    mic.stopMic();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeWorkletNode.lastInstance = null;
  });

  it('starts idle', () => {
    expect(mic.status).toBe('idle');
  });

  it('requestMic() routes through Tone.getContext()\'s worklet methods (not the native AudioWorkletNode global) and wires the node up', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    const { ctx, sourceNode, gainNode } = fakeAudioContext();

    const seen: string[] = [];
    mic.subscribe(() => seen.push(mic.status));
    const p = mic.requestMic(ctx);
    expect(mic.status).toBe('requesting');
    await p;

    expect(mic.status).toBe('ready');
    const toneCtx = vi.mocked(Tone.getContext).mock.results[0]!.value;
    expect(toneCtx.addAudioWorkletModule).toHaveBeenCalled();
    expect(toneCtx.createAudioWorkletNode).toHaveBeenCalledWith(
      'pitch-capture-processor',
      expect.objectContaining({ processorOptions: { bufferSize: 2048 } }),
    );
    const node = FakeWorkletNode.lastInstance!;
    expect(sourceNode.connect).toHaveBeenCalledWith(node);
    expect(node.connect).toHaveBeenCalledWith(gainNode);
    expect(gainNode.gain.value).toBe(0); // muted sink — never audibly monitored
    expect(seen).toEqual(['requesting', 'ready']);
  });

  it('sets status to "error" when the worklet module fails to load (e.g. no AudioWorklet support at all)', async () => {
    vi.mocked(Tone.getContext).mockReturnValue(
      fakeToneContext({ addModuleRejects: new Error('AudioWorklet not supported') }) as unknown as ReturnType<
        typeof Tone.getContext
      >,
    );
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    await mic.requestMic(fakeAudioContext().ctx);
    expect(mic.status).toBe('error');
    expect(mic.lastError).toBe('AudioWorklet not supported');
  });

  it('sets status to "denied" when getUserMedia rejects with a permission error', async () => {
    const denied = Object.assign(new DOMException('no', 'NotAllowedError'));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(denied) } });
    await mic.requestMic(fakeAudioContext().ctx);
    expect(mic.status).toBe('denied');
    expect(mic.lastError).toBeNull();
  });

  it('sets status to "error" and records lastError for any other getUserMedia failure (e.g. no mic device)', async () => {
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
    await mic.requestMic(fakeAudioContext().ctx);
    await mic.requestMic(fakeAudioContext().ctx);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('onFrame delivers frequency/clarity/rms computed from the raw audio buffer', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    const { ctx } = fakeAudioContext();
    await mic.requestMic(ctx);

    const frames: MicFrame[] = [];
    mic.onFrame((f) => frames.push(f));

    const sine = makeSine(220, ctx.sampleRate, 2048);
    FakeWorkletNode.lastInstance!.port.onmessage!({ data: sine } as MessageEvent<Float32Array>);

    expect(frames).toHaveLength(1);
    expect(frames[0]!.frequency).not.toBeNull();
    expect(Math.abs(1200 * Math.log2(frames[0]!.frequency! / 220))).toBeLessThan(5);
    expect(frames[0]!.rms).toBeGreaterThan(0);
  });

  it('onFrame unsubscribe stops delivering further frames', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    const { ctx } = fakeAudioContext();
    await mic.requestMic(ctx);

    const frames: MicFrame[] = [];
    const unsubscribe = mic.onFrame((f) => frames.push(f));
    unsubscribe();

    const sine = makeSine(220, ctx.sampleRate, 2048);
    FakeWorkletNode.lastInstance!.port.onmessage!({ data: sine } as MessageEvent<Float32Array>);
    expect(frames).toHaveLength(0);
  });

  it('stopMic() disconnects everything, stops the media stream tracks, and resets to idle', async () => {
    const stream = fakeStream();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
    const { ctx, sourceNode, gainNode } = fakeAudioContext();
    await mic.requestMic(ctx);
    const node = FakeWorkletNode.lastInstance!;

    mic.stopMic();

    expect(mic.status).toBe('idle');
    expect(sourceNode.disconnect).toHaveBeenCalled();
    expect(node.disconnect).toHaveBeenCalled();
    expect(gainNode.disconnect).toHaveBeenCalled();
    expect((stream.getTracks()[0] as unknown as { stop: ReturnType<typeof vi.fn> }).stop).toHaveBeenCalled();
  });

  it('subscribe() returns a working unsubscribe function', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    const listener = vi.fn();
    const unsubscribe = mic.subscribe(listener);
    unsubscribe();
    await mic.requestMic(fakeAudioContext().ctx);
    expect(listener).not.toHaveBeenCalled();
  });
});
