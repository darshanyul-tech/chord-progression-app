import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CATEGORY_ORDER, CATEGORY_TITLES, TOPICS } from '../topics/registry';
import { useCustomPresets } from '../state/customPresets';
import { useUIStore } from '../state/ui';

const TOPIC_PATH_PREFIX = '/topic/';

export function SyllabusMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const drawerOpen = useUIStore((s) => s.drawerOpen);
  const closeDrawer = useUIStore((s) => s.closeDrawer);
  const examActive = useUIStore((s) => s.examActive);
  const presets = useCustomPresets((s) => s.presets);
  const applyPreset = useCustomPresets((s) => s.applyPreset);
  const sidebarRef = useRef<HTMLElement>(null);

  const activeId = location.pathname.startsWith(TOPIC_PATH_PREFIX)
    ? location.pathname.slice(TOPIC_PATH_PREFIX.length)
    : undefined;

  function go(id: string) {
    navigate(`/topic/${id}`);
    closeDrawer();
  }

  // Opening a preset applies it (overwriting that topic's live settings)
  // then navigates to the topic itself — no per-preset routes (docs/05-topics/14 §4).
  function openPreset(id: string, topicId: string) {
    applyPreset(id);
    navigate(`/topic/${topicId}`);
    closeDrawer();
  }

  // Esc-to-close + basic focus trap for the mobile drawer (02-ui-shell §8).
  // Closing (Esc, scrim click, or picking a topic) restores focus to
  // whatever had it before the drawer opened — normally the hamburger
  // button, since that's what the user clicked to get here.
  useEffect(() => {
    if (!drawerOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const sidebar = sidebarRef.current;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeDrawer();
        return;
      }
      if (e.key !== 'Tab' || !sidebar) return;
      const focusables = sidebar.querySelectorAll<HTMLElement>('button, a[href]');
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    sidebar?.querySelector<HTMLElement>('button, a[href]')?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <nav
      aria-label="Syllabus"
      ref={sidebarRef}
      className={`syllabus-sidebar${drawerOpen ? ' open' : ''}`}
    >
      <div className="syllabus-nav">
        {CATEGORY_ORDER.map((category) => {
          const visibleTopics = TOPICS.filter((t) => t.category === category && !t.hidden);
          if (!visibleTopics.length) return null;
          return (
            <div key={category}>
              <div className="syllabus-category-title">{CATEGORY_TITLES[category]}</div>
              {visibleTopics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`syllabus-topic${t.id === activeId ? ' active' : ''}`}
                  onClick={() => go(t.id)}
                  disabled={examActive}
                >
                  <span>{t.title}</span>
                  {t.status === 'placeholder' && <span className="syllabus-soon-tag">soon</span>}
                </button>
              ))}
              {category === 'custom' &&
                presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="syllabus-topic syllabus-preset"
                    onClick={() => openPreset(preset.id, preset.topicId)}
                    disabled={examActive}
                  >
                    <span>{preset.name}</span>
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
