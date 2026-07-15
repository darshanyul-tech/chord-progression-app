import { NoteGlyphIcon, RestGlyphIcon } from '../topics/rhythm-dictation/PaletteGlyph';
import type { NotePaletteEntry } from './notePaletteEntries';

export function NotePalette({
  entries,
  armedDuration,
  onArm,
}: {
  entries: NotePaletteEntry[];
  armedDuration: number;
  onArm: (duration: number) => void;
}) {
  return (
    <div className="note-palette">
      {entries.map((entry) => (
        <button
          key={entry.duration}
          type="button"
          className={`note-palette-btn${armedDuration === entry.duration ? ' armed' : ''}`}
          title={entry.title}
          aria-pressed={armedDuration === entry.duration}
          onClick={() => onArm(entry.duration)}
        >
          <NoteGlyphIcon duration={entry.duration} />
          <span>{entry.label}</span>
        </button>
      ))}
    </div>
  );
}

export function NotePaletteRestToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`note-palette-btn note-palette-rest${active ? ' armed' : ''}`}
      title="Rest"
      aria-pressed={active}
      onClick={onToggle}
    >
      <RestGlyphIcon />
      <span>Rest</span>
    </button>
  );
}
