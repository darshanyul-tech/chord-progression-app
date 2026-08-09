/** Everything an input overlay needs to hit-test clicks against a drawn stave, without holding onto VexFlow objects themselves. */
export interface MeasureGeometry {
  index: number;
  noteStartX: number;
  noteEndX: number;
  topLineY: number;
  spacing: number;
  /**
   * The real, post-Formatter x-position of every tickable currently drawn in
   * this measure, beat-ascending — see lib/notation/placement.ts's `xToBeat`,
   * which interpolates between these instead of assuming the note area is
   * evenly spaced by beat (it isn't, once very different durations coexist
   * in the same bar).
   */
  breakpoints: { beat: number; x: number }[];
}
