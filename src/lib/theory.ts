// Ported verbatim from legacy/jazz-progression-trainer-rhythm.html (shared helpers).
export const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function noteName(pc: number): string {
  return NOTE_NAMES[mod12(pc)];
}

export function midiToNoteName(midi: number): string {
  const pc = mod12(midi);
  const octave = Math.floor(midi / 12) - 1;
  return noteName(pc) + octave;
}

// Seedable RNG hook (09-improvement-plan.md §15.1, deferred since Phase 5):
// every exercise generator's randomness routes through random() below rather
// than calling Math.random() directly, so tests can call setRng() to make
// question generation deterministic. Lowest-churn approach — a module-level
// swap instead of threading an rng parameter through every ported signature.
//
// `overrideRng` is null (not a captured `Math.random` reference) by default,
// so random() falls through to a fresh `Math.random()` lookup each call —
// existing tests that `vi.spyOn(Math, 'random')` keep working unmodified;
// capturing `Math.random` into a variable at module load would freeze that
// reference before any later spy is installed, silently defeating it.
let overrideRng: (() => number) | null = null;

/** Test-only: replaces the RNG used by random()/pick()/shuffle() and every
 * generator's randomness. Call with no argument to restore Math.random(). */
export function setRng(fn?: () => number): void {
  overrideRng = fn ?? null;
}

export function random(): number {
  return overrideRng ? overrideRng() : Math.random();
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(random() * arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = a[i];
    a[i] = a[j]!;
    a[j] = t!;
  }
  return a;
}
