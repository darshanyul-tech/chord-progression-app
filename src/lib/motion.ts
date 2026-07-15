// Docs 09-improvement-plan.md §14.5 — the playback cursor rAF loops update
// state every frame (~60 Hz); under prefers-reduced-motion, throttle that to
// ~4 Hz instead of stopping the cursor outright, so motion-sensitive users
// still get the feedback without the constant flicker.
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const REDUCED_MOTION_INTERVAL_SEC = 0.25;
