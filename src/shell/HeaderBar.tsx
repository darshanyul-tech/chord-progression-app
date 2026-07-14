import { useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '../state/ui';

export function HeaderBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const toggleDrawer = useUIStore((s) => s.toggleDrawer);
  const onExamRoute = location.pathname === '/exam';

  return (
    <header className="shell-header">
      <div className="shell-header-inner">
        <button
          type="button"
          className="shell-hamburger"
          aria-label="Open syllabus menu"
          onClick={toggleDrawer}
        >
          &#9776;
        </button>
        <div className="shell-header-title-group">
          <div>
            <h1>Ear Trainer</h1>
            <p className="sub">Train your ear — harmony, melody &amp; rhythm.</p>
          </div>
        </div>
        <div className="shell-header-actions">
          <button type="button" onClick={() => navigate('/exam')} disabled={onExamRoute}>
            Exam mode
          </button>
        </div>
      </div>
    </header>
  );
}
