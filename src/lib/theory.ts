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

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j]!;
    a[j] = t!;
  }
  return a;
}
