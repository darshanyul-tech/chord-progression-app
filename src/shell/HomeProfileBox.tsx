import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { accuracyPct } from '../lib/stats/aggregate';
import type { Tally } from '../lib/stats/types';
import { useStatsStore } from '../state/statsStore';
import { useAdvancedMode } from '../state/advancedMode'; // ADVANCED USER MODE (trial) — remove with the feature
import { ProfileMenu } from './ProfileMenu';

// Home-only box surfacing the current profile and a link into the progress
// dashboard. Deliberately not in the header — it lives here so the header
// stays just the logo + section nav (see 13-home-and-sections.md).
export function HomeProfileBox() {
  const data = useStatsStore((s) => s.data);
  const [advanced, setAdvanced] = useAdvancedMode(); // ADVANCED USER MODE (trial)

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

      {/* ── ADVANCED USER MODE (trial) — remove this block to remove the toggle ── */}
      <div className="home-advanced-mode">
        <div className="home-advanced-mode-text">
          <span className="home-advanced-mode-label" id="home-advanced-title">Advanced user mode</span>
          <span className="home-advanced-mode-note">Hides the explanatory hints under toggles and topics.</span>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            aria-labelledby="home-advanced-title"
            checked={advanced}
            onChange={(e) => setAdvanced(e.target.checked)}
          />
          <span className="toggle-slider" aria-hidden="true" />
        </label>
      </div>
      {/* ── end advanced user mode ── */}
    </div>
  );
}
