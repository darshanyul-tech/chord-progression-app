import { useEffect, useState } from 'react';
import { INVERSION_LABELS, type InversionChordDef } from '../../lib/recognition/chords';

export interface InversionGuessPickerProps {
  /** Enabled inversion chords (quality chips). */
  qualities: InversionChordDef[];
  /** Enabled inversion numbers per subsection, e.g. { sevenths: [1,2], ninths: [1,2,3] }. */
  enabledInversions: { sevenths: number[]; ninths: number[] };
  /** Submit a combined guess of the form "inv:<quality>:<inversion>". */
  onGuess(id: string): void;
  wrongIds: string[];
  answered: boolean;
  /** No active question, or the round is over. */
  disabled: boolean;
  /** The correct quality + inversion, shown once answered (null for a plain-chord question). */
  reveal: { quality: string; inversion: number } | null;
  /** Changes each new question so the selection resets. */
  resetKey: string;
}

const comboId = (quality: string, inversion: number) => `inv:${quality}:${inversion}`;

// Two-part inversion answer: pick a chord quality AND an inversion, then guess —
// instead of one chip per quality×inversion combination.
export function InversionGuessPicker({
  qualities,
  enabledInversions,
  onGuess,
  wrongIds,
  answered,
  disabled,
  reveal,
  resetKey,
}: InversionGuessPickerProps) {
  const [quality, setQuality] = useState<string | null>(null);
  const [inversion, setInversion] = useState<number | null>(null);

  // Fresh selection for every new question.
  useEffect(() => {
    setQuality(null);
    setInversion(null);
  }, [resetKey]);

  if (!qualities.length) return null;

  const subsectionOf = (q: string): 'sevenths' | 'ninths' =>
    qualities.find((c) => c.quality === q)?.subsection ?? 'sevenths';
  const validInversions = (q: string | null): number[] =>
    q === null
      ? [...new Set([...enabledInversions.sevenths, ...enabledInversions.ninths])].sort((a, b) => a - b)
      : enabledInversions[subsectionOf(q)];

  // Union of every enabled inversion — chips not valid for the picked quality
  // are shown disabled so the layout doesn't jump around.
  const inversionChips = [...new Set([...enabledInversions.sevenths, ...enabledInversions.ninths])].sort(
    (a, b) => a - b,
  );

  function pickQuality(q: string) {
    setQuality(q);
    // Drop an inversion that the new quality can't take (e.g. 3rd on a 7th chord).
    if (inversion !== null && !validInversions(q).includes(inversion)) setInversion(null);
  }

  const selectedId = quality !== null && inversion !== null ? comboId(quality, inversion) : null;
  const alreadyWrong = selectedId !== null && wrongIds.includes(selectedId);
  const canGuess = !disabled && !answered && selectedId !== null && !alreadyWrong;

  function guess() {
    if (!canGuess || selectedId === null) return;
    onGuess(selectedId);
    setQuality(null);
    setInversion(null);
  }

  return (
    <div className="inversion-guess">
      <h3 className="chord-answer-group-title">Inversion chords</h3>
      <p className="help" style={{ margin: '0 0 0.5rem' }}>
        Select the chord quality and the inversion, then Guess.
      </p>

      <div className="inversion-guess-row" role="group" aria-label="Inversion chord quality">
        {qualities.map((c) => {
          const isReveal = answered && reveal?.quality === c.quality;
          const cls = ['chord-choice', quality === c.quality ? 'selected' : '', isReveal ? 'correct reveal-actual' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button key={c.id} type="button" className={cls} disabled={disabled || answered} onClick={() => pickQuality(c.quality)}>
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="inversion-guess-row" role="group" aria-label="Inversion">
        {inversionChips.map((n) => {
          const invalid = quality !== null && !validInversions(quality).includes(n);
          const isReveal = answered && reveal?.inversion === n;
          const cls = ['chord-choice', inversion === n ? 'selected' : '', isReveal ? 'correct reveal-actual' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={n}
              type="button"
              className={cls}
              disabled={disabled || answered || invalid}
              onClick={() => setInversion(n)}
            >
              {INVERSION_LABELS[n]}
            </button>
          );
        })}
      </div>

      <div className="inversion-guess-actions">
        <button type="button" onClick={guess} disabled={!canGuess}>
          Guess
        </button>
        {alreadyWrong && <span className="help">Already tried — pick a different combination.</span>}
      </div>
    </div>
  );
}
