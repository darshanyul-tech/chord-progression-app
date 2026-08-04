import { describe, expect, it } from 'vitest';
import { computeSystemLayout } from './systemLayout';

const base = { minMeasurePx: 300, marginLeft: 10, marginRight: 10 };

describe('computeSystemLayout', () => {
  it('renders at 1:1 (canvasWidth == container width) so notes keep native size', () => {
    const l = computeSystemLayout(4, 1200, base);
    expect(l.canvasWidth).toBe(1200);
  });

  it('fits as many measures per row as the width allows at the target measure size', () => {
    // usable = 1200 - 20 = 1180; floor(1180/300) = 3 per row.
    const l = computeSystemLayout(6, 1200, base);
    expect(l.measuresPerRow).toBe(3);
    expect(l.numRows).toBe(2);
  });

  it('wraps onto more rows as the container narrows (the stacking behaviour)', () => {
    const wide = computeSystemLayout(4, 1400, base); // floor(1380/300)=4 -> 1 row
    const narrow = computeSystemLayout(4, 700, base); // floor(680/300)=2 -> 2 rows
    const tiny = computeSystemLayout(4, 320, base); // floor(300/300)=1 -> 4 rows
    expect(wide.numRows).toBe(1);
    expect(narrow.numRows).toBe(2);
    expect(tiny.numRows).toBe(4);
  });

  it('never puts more measures on a row than exist, and always at least one', () => {
    expect(computeSystemLayout(2, 5000, base).measuresPerRow).toBe(2);
    expect(computeSystemLayout(3, 100, base).measuresPerRow).toBe(1); // too narrow -> 1/row
  });

  it('honours a maxPerRow ceiling on very wide pages', () => {
    const l = computeSystemLayout(8, 4000, { ...base, maxPerRow: 4 });
    expect(l.measuresPerRow).toBe(4);
  });

  it('falls back to the legacy fixed canvas + per-row count when width is unknown (0)', () => {
    const melodic = computeSystemLayout(1, 0, { ...base, fallbackPerRow: 2, fallbackCanvasWidth: 1000 });
    expect(melodic.canvasWidth).toBe(1000);
    expect(melodic.measuresPerRow).toBe(1); // min(numMeasures, fallbackPerRow)
    const rhythm = computeSystemLayout(4, 0, { ...base, fallbackPerRow: 4, fallbackCanvasWidth: 1000 });
    expect(rhythm.measuresPerRow).toBe(4); // all on one row, legacy rhythm
    expect(rhythm.numRows).toBe(1);
  });
});
