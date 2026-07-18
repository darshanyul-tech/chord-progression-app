/** Everything an input overlay needs to hit-test clicks against a drawn stave, without holding onto VexFlow objects themselves. */
export interface MeasureGeometry {
  index: number;
  noteStartX: number;
  noteEndX: number;
  topLineY: number;
  spacing: number;
}
