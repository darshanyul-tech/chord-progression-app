import { useLocation } from 'react-router-dom';

// Matches the trailing `/topic/<id>` segment regardless of section prefix
// (`/aural/topic/x`, `/theory/topic/x`) or the legacy unprefixed `/topic/x`
// still used by a handful of component tests that render outside the full
// router (13-home-and-sections.md §2).
export function useIsActiveTopic(topicId: string): boolean {
  const location = useLocation();
  return location.pathname.endsWith(`/topic/${topicId}`);
}
