import * as Tone from 'tone';

// Port of legacy initAudio() (03-audio-engine.md §2). Framework-free singleton;
// components only touch this through useAudioReady() (the one React coupling).
export type AudioStatus = 'idle' | 'loading' | 'ready' | 'error';

const SAMPLE_BASE_URL = '/samples/piano/';

let status: AudioStatus = 'idle';
let loading = false;
let sampler: Tone.Sampler | null = null;
let lastError: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

async function initAudio(): Promise<void> {
  if (status === 'ready' || loading) return;
  loading = true;
  status = 'loading';
  notify();
  try {
    await Tone.start();
    sampler = new Tone.Sampler({
      urls: {
        A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
        A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
        A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
        A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3',
      },
      baseUrl: SAMPLE_BASE_URL,
      release: 1.6,
    }).toDestination();
    sampler.volume.value = -6;
    await Tone.loaded();
    status = 'ready';
    lastError = null;
  } catch (err) {
    status = 'error';
    sampler = null;
    lastError = err instanceof Error ? err.message : String(err);
  } finally {
    loading = false;
    notify();
  }
}

export const audio = {
  initAudio,
  get status(): AudioStatus {
    return status;
  },
  get sampler(): Tone.Sampler | null {
    return sampler;
  },
  get lastError(): string | null {
    return lastError;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  now(): number {
    return Tone.now();
  },
};
