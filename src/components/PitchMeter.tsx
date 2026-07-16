// Extracted from interval-singing/IntervalSingingTopic.tsx on gaining its
// second consumer (Chord Singing, docs/05-topics/10 §5) — same rule as
// NotePalette/IntervalMatrix's extractions.
export function PitchMeter({ centsOffset, toleranceCents }: { centsOffset: number | null; toleranceCents: number }) {
  const clamped = centsOffset === null ? 0 : Math.max(-100, Math.min(100, centsOffset));
  const pct = 50 + (clamped / 100) * 50;
  const inTolerance = centsOffset !== null && Math.abs(centsOffset) <= toleranceCents;
  const toleranceWidthPct = (toleranceCents / 100) * 100;

  return (
    <div className="pitch-meter">
      <div
        className="pitch-meter-track"
        role="img"
        aria-label={centsOffset === null ? 'Listening for pitch' : `${Math.round(centsOffset)} cents from the target`}
      >
        <div
          className="pitch-meter-tolerance"
          style={{ left: `${50 - toleranceWidthPct / 2}%`, width: `${toleranceWidthPct}%` }}
        />
        <div className="pitch-meter-center" />
        {centsOffset !== null && (
          <div className={`pitch-meter-needle${inTolerance ? ' in-tune' : ''}`} style={{ left: `${pct}%` }} />
        )}
      </div>
      <p className="pitch-meter-label">
        {centsOffset === null ? 'Listening…' : `${centsOffset > 0 ? '+' : ''}${Math.round(centsOffset)}¢ from target`}
      </p>
    </div>
  );
}
