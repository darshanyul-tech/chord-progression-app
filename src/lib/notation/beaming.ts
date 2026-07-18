import { Beam, type StaveNote } from 'vexflow';

/**
 * Groups time-adjacent, sub-beat, non-rest notes into beamable runs. `sorted`
 * must already be beat-ascending. A run needs 2+ notes with no gap or rest
 * between them — VexFlow only draws flags on lone notes and on notes broken
 * apart by a rest or a silent gap; beaming across either looks wrong and
 * used to happen because beams were generated after the notes had already
 * drawn their own flags/stems (docs/12 RC-2). `isRest` lets each topic's own
 * note shape (RhythmNote.isRest vs melody's PitchedNote.rest) plug in
 * without this algorithm caring which it is — shared by both staff
 * renderers so a beam group can never disagree between the two topics.
 */
export function beamableRuns<T extends { beat: number; duration: number }>(
  sorted: T[],
  isRest: (n: T) => boolean,
): T[][] {
  const runs: T[][] = [];
  let current: T[] = [];
  let cursor: number | null = null;
  for (const n of sorted) {
    const beamable = !isRest(n) && n.duration < 1 - 0.001;
    const adjacent = beamable && cursor !== null && Math.abs(n.beat - cursor) < 0.001;
    if (beamable && adjacent) {
      current.push(n);
    } else {
      if (current.length > 1) runs.push(current);
      current = beamable ? [n] : [];
    }
    cursor = beamable ? n.beat + n.duration : null;
  }
  if (current.length > 1) runs.push(current);
  return runs;
}

/**
 * Builds (but does not draw) every beam group in a measure, grouped at the
 * meter's own main-beat boundaries (`Beam.getDefaultBeamGroups`) — e.g. four
 * eighths crossing beat 2 in 4/4 split into two beam groups, not one long
 * beam. A run whose notes include the hover-preview ghost gets styled in
 * `hoverColor` instead of `style`, matching how the ghost's own notehead is
 * styled (see notation/tickables.ts's buildGapPaddedTickables).
 *
 * Returns a plain `Beam[]` rather than drawing directly: VexFlow requires
 * beams to be *generated* — which prepares their notes' stems — before
 * `voice.draw()`, but the beams' own `.draw()` calls happen after it
 * (generating them afterward causes doubled flags / stems that don't reach
 * the beam, docs/12 RC-2), so the caller owns that ordering around its own
 * `voice.draw()` call.
 *
 * This replaced an earlier version (rhythm dictation only) that beamed
 * *every* non-rest note in the bar as a single ungrouped
 * `Beam.generateBeams()` call — with no gap/rest/beat-boundary awareness, a
 * beam could bridge across a rest or a quarter note sitting between two
 * eighth-note pairs, since VexFlow's own grouping only sees the list it's
 * handed, not the notes filtered out of it.
 */
export function generateBeamedRuns<T extends { beat: number; duration: number }>(
  sorted: T[],
  noteToStave: ReadonlyMap<T, StaveNote>,
  isRest: (n: T) => boolean,
  beatsPerBar: number,
  beatValue: number,
  ghostRef: T | null,
  style: { fillStyle: string; strokeStyle: string } | undefined,
  hoverColor: string,
): Beam[] {
  const beamGroups = Beam.getDefaultBeamGroups(`${beatsPerBar}/${beatValue}`);
  return beamableRuns(sorted, isRest).flatMap((run) => {
    const runStaveNotes = run.map((n) => noteToStave.get(n)!);
    const runBeams = Beam.generateBeams(runStaveNotes, { groups: beamGroups });
    if (ghostRef && run.includes(ghostRef)) {
      runBeams.forEach((b) => b.setStyle({ fillStyle: hoverColor, strokeStyle: hoverColor }));
    } else if (style) {
      runBeams.forEach((b) => b.setStyle(style));
    }
    return runBeams;
  });
}
