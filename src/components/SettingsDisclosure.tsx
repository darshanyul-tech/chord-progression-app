import { useState, type ReactNode } from 'react';
import '../styles/settings-disclosure.css';

interface SettingsDisclosureProps {
  children: ReactNode;
  /** Summary label; defaults to a generic "Settings" so every topic reads the same. */
  label?: string;
  /** Start expanded. Defaults to collapsed — the whole point is an uncluttered practice screen. */
  defaultOpen?: boolean;
}

/**
 * Collapsible wrapper that tucks a topic's settings card into a native
 * <details> dropdown, so the practice area isn't crowded by settings while
 * you're actually using it. The wrapped settings component still renders its
 * own `.card` + `<h2>`; the disclosure supplies the card shell and header, and
 * CSS strips the inner chrome/title (see settings-disclosure.css).
 *
 * `open` is React-controlled (not just an initial attribute) so frequent
 * re-renders from the topic's practice state can't snap it shut mid-use.
 */
export function SettingsDisclosure({ children, label = 'Settings', defaultOpen = false }: SettingsDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="card settings-disclosure" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="settings-disclosure-summary">
        <span className="settings-disclosure-label">
          <span className="settings-disclosure-gear" aria-hidden="true">
            &#9881;
          </span>
          {label}
        </span>
        <span className="settings-disclosure-chevron" aria-hidden="true">
          &#9662;
        </span>
      </summary>
      <div className="settings-disclosure-body">{children}</div>
    </details>
  );
}
