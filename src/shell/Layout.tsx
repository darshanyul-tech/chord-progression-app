import type { ReactNode } from 'react';
import { Footer } from './Footer';
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
      <Footer />
    </>
  );
}
