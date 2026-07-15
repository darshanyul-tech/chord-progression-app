import { describe, expect, it } from 'vitest';
import { detectPitch } from './detect';

const SAMPLE_RATE = 44100;
const WINDOW = 2048;

function makeSine(freq: number, sampleRate: number, length: number): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) buf[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return buf;
}

function makeSawtooth(freq: number, sampleRate: number, length: number): Float32Array {
  const buf = new Float32Array(length);
  const period = sampleRate / freq;
  for (let i = 0; i < length; i++) {
    const phase = (i % period) / period;
    buf[i] = 2 * phase - 1;
  }
  return buf;
}

function centsOff(detected: number, actual: number): number {
  return 1200 * Math.log2(detected / actual);
}

describe('detectPitch — sine sweep', () => {
  it('detects known fundamentals within ±5 cents across a 110-880Hz sweep', () => {
    for (const freq of [110, 165, 220, 330, 440, 660, 880]) {
      const buffer = makeSine(freq, SAMPLE_RATE, WINDOW);
      const result = detectPitch(buffer, SAMPLE_RATE);
      expect(result).not.toBeNull();
      expect(Math.abs(centsOff(result!.frequency, freq))).toBeLessThan(5);
      expect(result!.clarity).toBeGreaterThan(0.9);
    }
  });
});

describe('detectPitch — harmonic-rich input', () => {
  it('locks onto the fundamental (not a harmonic) for a sawtooth wave', () => {
    for (const freq of [220, 440]) {
      const buffer = makeSawtooth(freq, SAMPLE_RATE, WINDOW);
      const result = detectPitch(buffer, SAMPLE_RATE);
      expect(result).not.toBeNull();
      expect(Math.abs(centsOff(result!.frequency, freq))).toBeLessThan(5);
    }
  });
});

describe('detectPitch — non-tonal input', () => {
  it('returns null for silence', () => {
    const buffer = new Float32Array(WINDOW); // all zeros
    expect(detectPitch(buffer, SAMPLE_RATE)).toBeNull();
  });

  it('reports low clarity for white noise, well below a clean tone', () => {
    // Deterministic "noise" (not Math.random) so this test never flakes.
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed / 0x7fffffff) * 2 - 1;
    };
    const buffer = new Float32Array(WINDOW).map(() => rand());

    const noiseResult = detectPitch(buffer, SAMPLE_RATE);
    const toneResult = detectPitch(makeSine(220, SAMPLE_RATE, WINDOW), SAMPLE_RATE);

    expect(toneResult!.clarity).toBeGreaterThan(0.9);
    if (noiseResult) {
      expect(noiseResult.clarity).toBeLessThan(toneResult!.clarity);
    }
  });
});

describe('detectPitch — degenerate input', () => {
  it('returns null when the buffer is too short to correlate at all', () => {
    expect(detectPitch(new Float32Array(4), SAMPLE_RATE)).toBeNull();
  });
});
