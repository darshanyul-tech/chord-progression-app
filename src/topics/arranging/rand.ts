// Tiny generation helpers for Arranging exercises (Math.random-backed).

export function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Sample n distinct items. */
export function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

/** Build MC distractors: the answer plus n distinct wrong options, shuffled. */
export function withDistractors(
  answer: string,
  pool: readonly string[],
  n: number,
): { id: string; label: string }[] {
  const wrong = sample(
    pool.filter((p) => p !== answer),
    n,
  );
  return shuffle([answer, ...wrong]).map((label) => ({ id: label, label }));
}
