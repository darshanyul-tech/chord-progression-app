import { useUIStore } from '../state/ui';
import trytoneLogo from '../assets/trytone-logo-with-text.png';

export function HeaderBar() {
  const toggleDrawer = useUIStore((s) => s.toggleDrawer);

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
            <h1 className="sr-only">TryTone</h1>
            <img src={trytoneLogo} alt="TryTone" className="shell-logo" />
          </div>
        </div>
      </div>
    </header>
  );
}
