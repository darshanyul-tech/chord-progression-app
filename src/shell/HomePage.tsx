import { Link } from 'react-router-dom';
import { Footer } from './Footer';
import { HeaderBar } from './HeaderBar';
import { DEFAULT_TOPIC_BY_SECTION, SECTIONS, topicsForSection } from '../topics/registry';

// The landing point for anyone who loads the site — no sidebar, no
// hamburger (there's no syllabus to open here); just the header, a welcome
// line, and one card per section (13-home-and-sections.md §4).
export function HomePage() {
  return (
    <>
      <HeaderBar />
      <main>
        <div className="home-sections">
          <div className="home-welcome">
            <h2>Welcome to TryTone</h2>
            <p>Train your ear, and your theory.</p>
          </div>
          <div className="home-section-grid">
            {SECTIONS.map((s) => {
              const activeCount = topicsForSection(s.id).filter((t) => t.status === 'active').length;
              return (
                <Link key={s.id} to={`/${s.id}/topic/${DEFAULT_TOPIC_BY_SECTION[s.id]}`} className="home-section-card">
                  <h3>{s.title}</h3>
                  <p>{s.blurb}</p>
                  <span className="home-topic-count">
                    {activeCount} topic{activeCount === 1 ? '' : 's'}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
