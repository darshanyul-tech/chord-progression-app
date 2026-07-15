import { durationClose } from '../rhythm/time';

// Maps our internal beat-unit durations (4=whole ... 0.25=sixteenth, plus
// dotted/triplet variants) to VexFlow duration codes + dot count. Display
// only — grading/generation never touch these values (they stay in beat
// units throughout lib/rhythm).
export interface VexDuration {
  duration: string;
  dots: number;
}

export function vexDurationFor(d: number): VexDuration {
  if (durationClose(d, 4)) return { duration: 'w', dots: 0 };
  if (durationClose(d, 2)) return { duration: 'h', dots: 0 };
  if (durationClose(d, 3)) return { duration: 'h', dots: 1 };
  if (durationClose(d, 1)) return { duration: 'q', dots: 0 };
  if (durationClose(d, 1.5)) return { duration: 'q', dots: 1 };
  if (durationClose(d, 0.5)) return { duration: '8', dots: 0 };
  if (durationClose(d, 0.75)) return { duration: '8', dots: 1 };
  if (durationClose(d, 0.25)) return { duration: '16', dots: 0 };
  if (durationClose(d, 0.333)) return { duration: '8', dots: 0 }; // triplet eighth
  if (durationClose(d, 0.667)) return { duration: 'q', dots: 0 }; // triplet quarter
  return { duration: 'q', dots: 0 };
}
