import { useLocation } from 'react-router-dom';

export function useIsActiveTopic(topicId: string): boolean {
  const location = useLocation();
  return location.pathname === `/topic/${topicId}`;
}
