import { Link, useLocation } from 'react-router-dom';
import { useUIStore } from '../state/ui';
import { DEFAULT_TOPIC_BY_SECTION, SECTIONS, type SectionId } from '../topics/registry';
import trytoneLogo from '../assets/trytone-logo-with-text.png';

// 13-home-and-sections.md §6. Home is active only on '/'; otherwise the
// active section is read from the route — /exam carries no section prefix
// but is aural-only content, so it highlights Aural (docs/13 §6/§2).
function activeSectionFor(pathname: string): SectionId | null {
  if (pathname === '/') return null;
  return pathname.startsWith('/theory/') ? 'theory' : 'aural';
}

export function HeaderBar() {
  const toggleDrawer = useUIStore((s) => s.toggleDrawer);
  const examActive = useUIStore((s) => s.examActive);
  const location = useLocation();
  const isHome = location.pathname === '/';
  const activeSection = activeSectionFor(location.pathname);

  return (
    <header className="shell-header">
      <div className="shell-header-inner">
        {!isHome && (
          <button
            type="button"
            className="shell-hamburger"
            aria-label="Open syllabus menu"
            onClick={toggleDrawer}
          >
            &#9776;
          </button>
        )}
        <div className="shell-header-title-group">
          <div>
            <h1 className="sr-only">TryTone</h1>
            <img src={trytoneLogo} alt="TryTone" className="shell-logo" />
          </div>
        </div>
        <nav aria-label="Sections" className="shell-section-nav">
          {examActive ? (
            <>
              <span className="shell-section-link disabled" aria-disabled="true">
                Home
              </span>
              {SECTIONS.map((s) => (
                <span
                  key={s.id}
                  className={`shell-section-link disabled${activeSection === s.id ? ' active' : ''}`}
                  aria-disabled="true"
                >
                  {s.navLabel}
                </span>
              ))}
            </>
          ) : (
            <>
              <Link to="/" className={`shell-section-link${isHome ? ' active' : ''}`}>
                Home
              </Link>
              {SECTIONS.map((s) => (
                <Link
                  key={s.id}
                  to={`/${s.id}/topic/${DEFAULT_TOPIC_BY_SECTION[s.id]}`}
                  className={`shell-section-link${activeSection === s.id ? ' active' : ''}`}
                >
                  {s.navLabel}
                </Link>
              ))}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
