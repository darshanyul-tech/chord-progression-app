// Low interval limits — the register below which a harmonic interval turns
// muddy (its low partials clash faster than the ear can resolve them).
//
// These values are taken from the arranging course's own LIL rules, as already
// encoded for the Arranging section in src/lib/arranging/rules.ts (checkLIL,
// spec §5.3, Sussman & Abene ch. 8). We deliberately mirror that source of
// truth rather than a generic orchestration chart, so the aural exercises and
// the arranging grader agree on what "too low" means.
//
// The two general principles that apply to a close, root-position-ish voicing:
//   Principle 1 — an interval SMALLER than a major 3rd must not sit more than an
//                 octave below middle C; i.e. its lower note must be >= C3.
//   Principle 2 — avoid 6ths and 7ths below low F (F1).
// A major 3rd or wider is permitted below C3 by the coded principles (the full
// interval-by-interval chart that would refine those wider limits is the
// data-blocked item in the arranging spec, so we don't invent numbers for it).

// C3 = one octave below middle C (matches arranging rules.ts).
export const LIL_LOWER_LIMIT_MIDI = 48;
// F1 = "low F on the bass clef" (matches arranging rules.ts). Below this a 6th
// or 7th turns muddy. The aural generators never voice below C2 (36) > F1, so
// Principle 2 can't trigger here — kept for documentation/parity only.
export const LIL_SIXTH_SEVENTH_FLOOR_MIDI = 29;

// The lowest MIDI note the LOWER member of an interval of `semitones` may take.
// Returns 0 ("no low-interval-limit floor") for a major 3rd or wider, which the
// arranging principles permit arbitrarily low; callers clamp to their own
// absolute register minimum.
export function lowIntervalLimitMidi(semitones: number): number {
  const n = Math.max(0, Math.round(semitones));
  // Principle 1: intervals smaller than a major 3rd (< 4 semitones) held at C3.
  return n < 4 ? LIL_LOWER_LIMIT_MIDI : 0;
}
