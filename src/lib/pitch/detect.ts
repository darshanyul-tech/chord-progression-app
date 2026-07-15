// Framework-free pitch detector (docs/09-improvement-plan.md §16.2, D15-style
// ownership — hand-rolled rather than a dependency, since the algorithm is
// small and this makes it directly unit-testable against synthesized
// waveforms). Implements McLeod Pitch Method (MPM): a normalized square
// difference function (NSDF) in place of raw autocorrelation — normalizing
// removes the energy-dependent bias plain autocorrelation has, which is what
// lets "key maximum" peak-picking reliably prefer the true fundamental's lag
// over a harmonic's, without needing a separate windowing/pre-emphasis stage.

export interface PitchResult {
  /** Detected fundamental frequency in Hz. */
  frequency: number;
  /** NSDF peak height at the chosen lag, roughly in [0, 1] — how periodic/tonal the signal looks. */
  clarity: number;
}

/** Below this frequency the lag would exceed the analysis window for a typical buffer; also excludes room-hum/rumble lags from peak-picking. */
export const MIN_FREQUENCY_HZ = 60;
/** Above this, we're past any realistic singing fundamental — bounds the search window for speed and avoids locking onto a harmonic's very-short lag. */
export const MAX_FREQUENCY_HZ = 1500;
/** MPM's "key maximum" ratio (McLeod & Wyvill 2005): accept the first peak within this fraction of the highest peak found, rather than always the tallest — the earliest (shortest-lag) peak above threshold is the fundamental; a taller peak at 2x/3x the lag is usually a harmonic's stronger correlation, not evidence of a lower true pitch. */
const KEY_MAX_RATIO = 0.9;

/**
 * Normalized square difference function (McLeod & Wyvill 2005, eq. 6):
 * nsdf(tau) = 2 * sum(x[i]*x[i+tau]) / sum(x[i]^2 + x[i+tau]^2)
 * Bounded in [-1, 1] for well-formed input; nsdf(0) === 1 always.
 */
function computeNSDF(x: Float32Array, maxTau: number): Float32Array {
  const n = x.length;
  const nsdf = new Float32Array(maxTau);
  for (let tau = 0; tau < maxTau; tau++) {
    let acf = 0;
    let m = 0;
    const limit = n - tau;
    for (let i = 0; i < limit; i++) {
      const a = x[i]!;
      const b = x[i + tau]!;
      acf += a * b;
      m += a * a + b * b;
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }
  return nsdf;
}

/** Positions of the local maximum within each positive-going lobe of the NSDF (MPM peak-picking, ignoring the trivial tau=0 self-correlation lobe). */
function findPositiveLobeMaxima(nsdf: Float32Array): number[] {
  const maxima: number[] = [];
  const n = nsdf.length;
  let pos = 0;
  // Skip the initial positive lobe around tau=0 (always the highest, always
  // uninformative) until the curve first dips negative.
  while (pos < n - 1 && nsdf[pos]! > 0) pos++;
  while (pos < n - 1) {
    while (pos < n - 1 && nsdf[pos]! <= 0) pos++;
    if (pos >= n - 1) break;
    let localMaxIndex = pos;
    while (pos < n - 1 && nsdf[pos]! > 0) {
      if (nsdf[pos]! > nsdf[localMaxIndex]!) localMaxIndex = pos;
      pos++;
    }
    maxima.push(localMaxIndex);
  }
  return maxima;
}

/** Parabolic interpolation around index `idx` for sub-sample lag accuracy and a smoothed peak height. */
function parabolicInterpolate(nsdf: Float32Array, idx: number): { tau: number; value: number } {
  if (idx <= 0 || idx >= nsdf.length - 1) return { tau: idx, value: nsdf[idx]! };
  const x0 = nsdf[idx - 1]!;
  const x1 = nsdf[idx]!;
  const x2 = nsdf[idx + 1]!;
  const denom = x0 - 2 * x1 + x2;
  if (denom === 0) return { tau: idx, value: x1 };
  const delta = (0.5 * (x0 - x2)) / denom;
  return { tau: idx + delta, value: x1 - 0.25 * (x0 - x2) * delta };
}

/**
 * Detects the fundamental frequency of one analysis window. Returns null
 * when no periodic structure is found at all (silence, or a buffer too
 * short/quiet to correlate) — a low but non-null clarity is expected (and
 * left to the caller's confidence gate) for noisy/non-tonal input like room
 * hiss, matching detect.test.ts's white-noise-vs-silence distinction.
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): PitchResult | null {
  const minTau = Math.floor(sampleRate / MAX_FREQUENCY_HZ);
  const maxTau = Math.min(buffer.length - 1, Math.ceil(sampleRate / MIN_FREQUENCY_HZ));
  if (maxTau <= minTau + 1) return null;

  const nsdf = computeNSDF(buffer, maxTau);
  const maxima = findPositiveLobeMaxima(nsdf).filter((i) => i >= minTau);
  if (!maxima.length) return null;

  let globalMax = -Infinity;
  maxima.forEach((i) => {
    if (nsdf[i]! > globalMax) globalMax = nsdf[i]!;
  });
  const threshold = globalMax * KEY_MAX_RATIO;
  const chosenIndex = maxima.find((i) => nsdf[i]! >= threshold) ?? maxima[0]!;

  const { tau, value } = parabolicInterpolate(nsdf, chosenIndex);
  if (tau <= 0) return null;

  return { frequency: sampleRate / tau, clarity: Math.min(1, value) };
}
