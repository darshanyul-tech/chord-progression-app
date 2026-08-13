import { useSyncExternalStore } from 'react';

// Width below which finger-on-stave exercises are gated (see MobileUnavailableNotice
// / TopicDefinition.mobileUnavailable). Covers phones and small tablets in
// portrait, where both the note-placement touch precision and the stave scaling
// break down. Adjust here to move the cutoff.
const MOBILE_QUERY = '(max-width: 768px)';

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

// True on mobile-sized viewports; re-renders on resize across the breakpoint.
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
