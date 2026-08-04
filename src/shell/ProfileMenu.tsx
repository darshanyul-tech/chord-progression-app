import { useEffect, useRef, useState } from 'react';
import { isGuest } from '../lib/auth/authClient';
import { useProfileStore } from '../state/profileStore';

// Compact header control for optional local profiles. The app is fully usable
// without ever opening this — everyone starts as Guest.
export function ProfileMenu() {
  const active = useProfileStore((s) => s.active);
  const profiles = useProfileStore((s) => s.profiles);
  const error = useProfileStore((s) => s.error);
  const createProfile = useProfileStore((s) => s.createProfile);
  const signIn = useProfileStore((s) => s.signIn);
  const signOut = useProfileStore((s) => s.signOut);
  const deleteProfile = useProfileStore((s) => s.deleteProfile);
  const clearError = useProfileStore((s) => s.clearError);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pinFor, setPinFor] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function reset() {
    setCreating(false);
    setName('');
    setPin('');
    setPinFor(null);
    clearError();
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function handleCreate() {
    await createProfile(name.trim(), pin.trim() || undefined);
    if (!useProfileStore.getState().error) close();
  }

  async function handleSignIn(id: string) {
    await signIn(id, pin.trim() || undefined);
    if (!useProfileStore.getState().error) close();
  }

  const label = isGuest(active.id) ? 'Guest' : active.name;

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        type="button"
        className="profile-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        title="Profile"
      >
        <span className="profile-avatar" aria-hidden="true">
          {label.charAt(0).toUpperCase()}
        </span>
        <span className="profile-trigger-name">{label}</span>
      </button>

      {open && (
        <div className="profile-panel" role="menu">
          <p className="profile-current">
            {isGuest(active.id) ? (
              <>Playing as <strong>Guest</strong><br /><small>Progress is saved on this device.</small></>
            ) : (
              <>Signed in as <strong>{active.name}</strong></>
            )}
          </p>

          {error && <p className="profile-error" role="alert">{error}</p>}

          {!creating && (
            <>
              {profiles.length > 0 && (
                <ul className="profile-list">
                  {profiles.map((p) => (
                    <li key={p.id}>
                      {pinFor === p.id ? (
                        <form
                          className="profile-pin-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void handleSignIn(p.id);
                          }}
                        >
                          <input
                            type="password"
                            inputMode="numeric"
                            placeholder="PIN"
                            value={pin}
                            autoFocus
                            onChange={(e) => setPin(e.target.value)}
                            aria-label={`PIN for ${p.name}`}
                          />
                          <button type="submit">Go</button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className={`profile-switch${p.id === active.id ? ' current' : ''}`}
                          onClick={() => {
                            clearError();
                            setPin('');
                            setPinFor(p.id);
                          }}
                          disabled={p.id === active.id}
                        >
                          {p.name}
                        </button>
                      )}
                      <button
                        type="button"
                        className="profile-delete"
                        aria-label={`Delete ${p.name}`}
                        title="Delete profile"
                        onClick={() => void deleteProfile(p.id)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="profile-actions">
                <button type="button" onClick={() => { clearError(); setCreating(true); }}>
                  + New profile
                </button>
                {!isGuest(active.id) && (
                  <button type="button" onClick={() => void signOut().then(close)}>
                    Sign out (back to Guest)
                  </button>
                )}
              </div>
            </>
          )}

          {creating && (
            <form
              className="profile-create"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreate();
              }}
            >
              <label>
                Name
                <input
                  type="text"
                  value={name}
                  autoFocus
                  maxLength={40}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                PIN <small>(optional)</small>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  maxLength={12}
                  onChange={(e) => setPin(e.target.value)}
                />
              </label>
              <div className="profile-actions">
                <button type="submit" disabled={!name.trim()}>Create &amp; switch</button>
                <button type="button" onClick={reset}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
