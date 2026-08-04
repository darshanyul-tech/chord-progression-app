// Shared auth-token accessor. The session token (issued by the cPanel backend
// on sign-in) lives in localStorage and is sent as a Bearer header by every
// remote fetch. Kept in its own module so both the auth client and the stats
// backend can reach it without importing each other (no dependency cycle).
// In local-only mode no token is ever set, so getAuthToken() returns null.

const TOKEN_KEY = 'eartrainer.v1.auth.token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore — private mode / quota; the session just won't survive reload
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}
