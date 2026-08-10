// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED USER MODE — trial feature, intentionally self-contained.
//
// When on, a root `advanced-mode` class is added to <body>. The CSS block in
// styles/base.css (search "ADVANCED USER MODE") hides explanatory text
// (`.help`, `.sub`, and landing-card descriptions) for users who don't need it.
//
// TO REMOVE THE FEATURE ENTIRELY, delete these four things:
//   1. this file
//   2. the "ADVANCED USER MODE" block in styles/base.css
//   3. the toggle block in shell/HomeProfileBox.tsx
//   4. the initAdvancedMode() import + call in main.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';

const STORAGE_KEY = 'eartrainer.v1.ui.advancedMode';

export function isAdvancedMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function applyBodyClass(on: boolean): void {
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('advanced-mode', on);
  }
}

export function setAdvancedMode(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* ignore storage failures (private mode, quota, etc.) */
  }
  applyBodyClass(on);
}

// Sync the <body> class with the stored preference. Call once at startup so the
// preference is reflected on first paint, before any component mounts.
export function initAdvancedMode(): void {
  applyBodyClass(isAdvancedMode());
}

// Local hook for the toggle control: current value + a setter that persists and
// updates the body class.
export function useAdvancedMode(): readonly [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(isAdvancedMode);
  return [
    on,
    (next: boolean) => {
      setAdvancedMode(next);
      setOn(next);
    },
  ] as const;
}
