import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { accuracyPct } from '../lib/stats/aggregate';
import type { Tally } from '../lib/stats/types';
import { useStatsStore } from '../state/statsStore';
import { ProfileMenu } from './ProfileMenu';

// Home-only box surfacing the current profile and a link into the progress
// dashboard. Deliberately not in the header — it lives here so the header
// stays just the logo + section nav (see 13-home-and-sections.md).
export function HomeProfileBox() {
  const data = useStatsStore((s) => s.data);

  const grand = useMemo(
    () =>
      Object.values(data.topics).reduce<Tally>(
        (acc, t) => ({ correct: acc.correct + t.overall.correct, total: acc.total + t.overall.total }),
        { correct: 0, total: 0 },
      ),
    [data],
  );

  return (
    <div className="home-profile-box">
      <div className="home-profile-box-left">
        <span className="home-profile-box-label">Profile</span>
        <ProfileMenu />
      </div>

      <Link to="/stats" className="home-progress-btn">
        <span className="home-progress-btn-main">View your progress</span>
        <span className="home-progress-btn-sub">
          {grand.total > 0
            ? `${accuracyPct(grand)}% over ${grand.total} attempt${grand.total === 1 ? '' : 's'}`
            : 'No practice recorded yet'}
        </span>
      </Link>
    </div>
  );
}
