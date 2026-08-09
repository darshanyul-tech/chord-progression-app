import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from './Footer';
import { HeaderBar } from './HeaderBar';
import { accuracyPct, hasAnyAttempts } from '../lib/stats/aggregate';
import type { ItemStats, Tally, TopicStats } from '../lib/stats/types';
import { isGuest } from '../lib/auth/authClient';
import { useProfileStore } from '../state/profileStore';
import { useStatsStore } from '../state/statsStore';
import {
  getTopic,
  SECTIONS,
  sectionOfTopic,
  type SectionId,
} from '../topics/registry';

function AccuracyBar({ tally }: { tally: Tally }) {
  const pct = accuracyPct(tally);
  // Hue 0 (red) → 130 (green) across 0–100%. Empty tallies read neutral.
  const hue = tally.total === 0 ? 210 : Math.round((pct / 100) * 130);
  return (
    <div className="stats-bar" role="img" aria-label={`${pct}% accuracy`}>
      <div
        className="stats-bar-fill"
        style={{ width: `${pct}%`, background: `hsl(${hue} 65% 45%)` }}
      />
    </div>
  );
}

function ratioText(tally: Tally): string {
  return `${accuracyPct(tally)}% (${tally.correct}/${tally.total})`;
}

function ItemRow({ item }: { item: ItemStats }) {
  return (
    <tr>
      <th scope="row">{item.label}</th>
      <td className="stats-item-bar-cell">
        <AccuracyBar tally={item.tally} />
      </td>
      <td className="stats-num">{ratioText(item.tally)}</td>
    </tr>
  );
}

function TopicCard({
  topicId,
  stats,
  onReset,
}: {
  topicId: string;
  stats: TopicStats;
  onReset: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const title = getTopic(topicId)?.title ?? topicId;
  // Worst-first so weaknesses surface; ties broken by most-attempted.
  const items = useMemo(
    () =>
      Object.values(stats.items).sort(
        (a, b) =>
          accuracyPct(a.tally) - accuracyPct(b.tally) || b.tally.total - a.tally.total,
      ),
    [stats.items],
  );
  const hasBreakdown = items.length > 0;

  return (
    <div className="stats-topic">
      <div className="stats-topic-head">
        <button
          type="button"
          className="stats-topic-toggle"
          onClick={() => hasBreakdown && setOpen((o) => !o)}
          aria-expanded={hasBreakdown ? open : undefined}
          disabled={!hasBreakdown}
        >
          <span className="stats-topic-title">
            {hasBreakdown && <span className="stats-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>}
            {title}
          </span>
          <AccuracyBar tally={stats.overall} />
          <span className="stats-num">{ratioText(stats.overall)}</span>
        </button>
        <button
          type="button"
          className="stats-reset-btn"
          onClick={() => onReset(topicId)}
          aria-label={`Reset ${title} stats`}
          title="Reset this topic"
        >
          Reset
        </button>
      </div>
      {open && hasBreakdown && (
        <div className="stats-item-table-wrap">
          <table className="stats-item-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Accuracy</th>
                <th scope="col" className="stats-num">Rate</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ItemRow key={item.label} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function StatsPage() {
  const data = useStatsStore((s) => s.data);
  const resetTopic = useStatsStore((s) => s.resetTopic);
  const resetAll = useStatsStore((s) => s.resetAll);
  const importGuest = useStatsStore((s) => s.importGuest);
  const active = useProfileStore((s) => s.active);

  const [confirmReset, setConfirmReset] = useState(false);

  const bySection = useMemo(() => {
    const groups: Record<SectionId, { topicId: string; stats: TopicStats }[]> = {
      aural: [],
      theory: [],
      arranging: [],
    };
    for (const [topicId, stats] of Object.entries(data.topics)) {
      if (stats.overall.total === 0) continue;
      groups[sectionOfTopic(topicId)].push({ topicId, stats });
    }
    for (const key of Object.keys(groups) as SectionId[]) {
      groups[key].sort((a, b) => b.stats.lastPlayed - a.stats.lastPlayed);
    }
    return groups;
  }, [data]);

  const grandTotal = useMemo(() => {
    return Object.values(data.topics).reduce<Tally>(
      (acc, t) => ({ correct: acc.correct + t.overall.correct, total: acc.total + t.overall.total }),
      { correct: 0, total: 0 },
    );
  }, [data]);

  const empty = !hasAnyAttempts(data);

  return (
    <>
      <HeaderBar />
      <main>
        <div className="stats-page">
      <header className="stats-header">
        <div>
          <h1>Progress</h1>
          <p className="stats-profile-line">
            {isGuest(active.id) ? (
              <>Playing as <strong>Guest</strong> — progress is saved on this device.</>
            ) : (
              <>Signed in as <strong>{active.name}</strong>.</>
            )}
          </p>
        </div>
        {grandTotal.total > 0 && (
          <div className="stats-grand">
            <div className="stats-grand-pct">{accuracyPct(grandTotal)}%</div>
            <div className="stats-grand-sub">{grandTotal.total} attempts overall</div>
          </div>
        )}
      </header>

      {empty ? (
        <div className="stats-empty">
          <p>No practice recorded yet.</p>
          <p>
            Head to a topic and answer a few questions — your accuracy, and a breakdown of what
            you get right and wrong, will appear here.
          </p>
          <Link className="stats-cta" to="/">
            Pick a topic to get started
          </Link>
        </div>
      ) : (
        <>
          {!isGuest(active.id) && (
            <div className="stats-import">
              <button type="button" onClick={() => void importGuest()}>
                Import this device's guest progress into {active.name}
              </button>
            </div>
          )}

          {SECTIONS.map((section) => {
            const rows = bySection[section.id];
            if (rows.length === 0) return null;
            return (
              <section key={section.id} className="stats-section">
                <h2>{section.title}</h2>
                {rows.map(({ topicId, stats }) => (
                  <TopicCard key={topicId} topicId={topicId} stats={stats} onReset={resetTopic} />
                ))}
              </section>
            );
          })}

          <div className="stats-reset-all">
            {confirmReset ? (
              <>
                <span>Reset all progress for this profile?</span>
                <button
                  type="button"
                  className="stats-danger"
                  onClick={() => {
                    resetAll();
                    setConfirmReset(false);
                  }}
                >
                  Yes, reset everything
                </button>
                <button type="button" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmReset(true)}>
                Reset all progress
              </button>
            )}
          </div>
        </>
      )}
        </div>
      </main>
      <Footer />
    </>
  );
}
