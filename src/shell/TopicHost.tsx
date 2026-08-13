import { Suspense, useEffect, useState } from 'react';
import { getTopic, TOPICS } from '../topics/registry';
import { useUIStore } from '../state/ui';
import { ErrorBoundary } from './ErrorBoundary';
import { MobileWarningDialog } from './MobileWarningDialog';
import { PlaceholderView } from './PlaceholderView';
import { useIsMobile } from './useIsMobile';

/**
 * Keeps every "active" topic mounted once and toggles visibility (D9a) —
 * in-progress questions/settings/refs survive topic switches for free.
 * Placeholder topics are cheap and "unmount-safe" (01-architecture §4), so
 * only the current one is rendered.
 */
export function TopicHost({ activeId }: { activeId: string }) {
  const setLastActiveTopicId = useUIStore((s) => s.setLastActiveTopicId);
  const currentTopic = getTopic(activeId);
  const activeTopics = TOPICS.filter((t) => t.status === 'active');
  const isMobile = useIsMobile();
  // Caution shown each time a finger-on-stave exercise is opened on a small
  // screen. The exercise stays usable; dismissing clears it until the topic is
  // selected again.
  const [warnedTopic, setWarnedTopic] = useState<string | null>(null);

  useEffect(() => {
    setWarnedTopic(isMobile && currentTopic?.mobileUnavailable ? activeId : null);
  }, [activeId, isMobile, currentTopic]);

  useEffect(() => {
    if (currentTopic?.status === 'active') {
      setLastActiveTopicId(activeId);
    }
  }, [activeId, currentTopic, setLastActiveTopicId]);

  useEffect(() => {
    document.body.classList.toggle('theme-dark', currentTopic?.theme === 'dark');
  }, [currentTopic]);

  return (
    <>
      {activeTopics.map((t) => (
        <div
          key={t.id}
          className="topic-view"
          style={{ display: t.id === activeId ? undefined : 'none' }}
        >
          {t.Component ? (
            <ErrorBoundary label={t.title}>
              <Suspense fallback={<p className="sub">Loading…</p>}>
                <t.Component />
              </Suspense>
            </ErrorBoundary>
          ) : null}
        </div>
      ))}
      {currentTopic?.status === 'placeholder' && (
        <div className="topic-view">
          <PlaceholderView topic={currentTopic} />
        </div>
      )}
      {warnedTopic === activeId && currentTopic && (
        <MobileWarningDialog title={currentTopic.title} onDismiss={() => setWarnedTopic(null)} />
      )}
    </>
  );
}
