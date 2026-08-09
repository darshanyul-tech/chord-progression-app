import { Link } from 'react-router-dom';
import { Footer } from './Footer';
import { HeaderBar } from './HeaderBar';
import { TOPIC_DESCRIPTIONS } from '../topics/topicDescriptions';
import {
  CATEGORY_TITLES,
  DEFAULT_TOPIC_BY_SECTION,
  SECTION_CATEGORY_ORDER,
  SECTIONS,
  topicPath,
  topicsForSection,
  type SectionId,
} from '../topics/registry';

// A standalone page like Home/Stats — own header + footer, no syllabus
// sidebar (the user asked for it to disappear here just like it does on
// Home; the sidebar only makes sense once you're inside a specific topic).
export function SectionLandingPage({ section }: { section: SectionId }) {
  const def = SECTIONS.find((s) => s.id === section)!;
  const topics = topicsForSection(section).filter((t) => t.status === 'active' && !t.hidden);
  const categories = SECTION_CATEGORY_ORDER[section].filter((cat) => topics.some((t) => t.category === cat));

  return (
    <>
      <HeaderBar />
      <main>
        <div className="section-landing">
          <div className="section-landing-intro">
            <h2>{def.title}</h2>
            <p>{def.blurb}</p>
            <Link className="section-landing-jump" to={topicPath(DEFAULT_TOPIC_BY_SECTION[section])}>
              Jump straight in →
            </Link>
          </div>

          {categories.map((cat) => (
            <section key={cat} className="section-landing-group">
              <h3>{CATEGORY_TITLES[cat]}</h3>
              <div className="section-landing-grid">
                {topics
                  .filter((t) => t.category === cat)
                  .map((t) => (
                    <Link key={t.id} to={topicPath(t.id)} className="section-landing-card">
                      <h4>{t.title}</h4>
                      <p>{TOPIC_DESCRIPTIONS[t.id] ?? ''}</p>
                    </Link>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
