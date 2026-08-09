/**
 * Mouse-hover / keyboard-cursor placement preview colour, shared by every
 * staff-based input in the app (rhythm dictation, melodic dictation, meter
 * transposition, transposition's slot input, arranging's stave input, the
 * theory chord-stack input). One source of truth so a design change never
 * has to be hunted down across every topic that draws a preview.
 *
 * Deliberately a strong, opaque-reading blue rather than a faint tint — the
 * preview needs to read clearly as "this is what will happen", not as a
 * barely-there suggestion.
 */
export const PREVIEW_COLOR = 'rgba(30, 90, 214, 0.9)';

/**
 * Ghost outline of a real note a hover placement would displace — rendered
 * underneath the placement preview itself (PREVIEW_COLOR) so replacing a note
 * you can already see doesn't make it disappear before you've committed to
 * the swap. 50% grey reads as "still there, but going away" rather than a
 * second competing answer.
 */
export const VICTIM_COLOR = 'rgba(128, 128, 128, 0.5)';
