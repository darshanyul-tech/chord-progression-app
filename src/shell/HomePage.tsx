import { Link } from 'react-router-dom';
import { Footer } from './Footer';
import { HeaderBar } from './HeaderBar';
import { HomeProfileBox } from './HomeProfileBox';
import { SECTIONS, topicsForSection } from '../topics/registry';

// The landing point for anyone who loads the site — no sidebar, no
// hamburger (there's no syllabus to open here); just the header, a welcome
// line, and one card per section (13-home-and-sections.md §4). Each card
// links to that section's own overview page (SectionLandingPage), not
// straight into a specific topic — so arriving here never surprises you
// with a topic you didn't ask for.
export function HomePage() {
  return (
    <>
      <HeaderBar />
      <main>
        <div className="home-sections">
          <div className="home-welcome">
            <h2>Welcome to TryTone</h2>
            <p className="home-welcome-lede">
              Train your ear, and your theory. TryTone is a practice tool for musicians: recognise
              intervals, chords and rhythms by ear, drill written music theory, and work through
              arranging exercises — all in short, focused rounds that track your progress as you go.
            </p>
            <p className="home-welcome-sub">
              Pick a genre below to see what it covers, or jump straight into a topic from there.
            </p>
          </div>
          <HomeProfileBox />
          <div className="home-section-grid">
            {SECTIONS.map((s) => {
              const activeCount = topicsForSection(s.id).filter((t) => t.status === 'active' && !t.hidden).length;
              return (
                <Link key={s.id} to={`/${s.id}`} className="home-section-card">
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
