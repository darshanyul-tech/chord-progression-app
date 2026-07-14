import type { ReactNode } from 'react';
import { HeaderBar } from './HeaderBar';
import { SyllabusMenu } from './SyllabusMenu';
import { useUIStore } from '../state/ui';

export function Layout({ children }: { children: ReactNode }) {
  const drawerOpen = useUIStore((s) => s.drawerOpen);
  const closeDrawer = useUIStore((s) => s.closeDrawer);

  return (
    <>
      <HeaderBar />
      <div className="shell-layout">
        <SyllabusMenu />
        <div
          className={`syllabus-scrim${drawerOpen ? ' visible' : ''}`}
          onClick={closeDrawer}
          aria-hidden="true"
        />
        <main className="shell-main">{children}</main>
      </div>
      <footer>
        Ear trainer with rhythm dictation tab &middot; progression audio by{' '}
        <a href="https://tonejs.github.io/" target="_blank" rel="noopener">
          Tone.js
        </a>{' '}
        + Salamander samples.
      </footer>
    </>
  );
}
