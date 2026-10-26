/** Storage key of the Sanctum Bearer token issued by `POST /auth/login`. */
export const AUTH_TOKEN_KEY = 'ff_token';

const hasStorage = (s: 'localStorage' | 'sessionStorage'): boolean => typeof window !== 'undefined' && !!window[s];

/** Reads the token from localStorage ("remember me") or sessionStorage (this tab only). */
export function readAuthToken(): string | null {
  const local = hasStorage('localStorage') ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  return local ?? (hasStorage('sessionStorage') ? sessionStorage.getItem(AUTH_TOKEN_KEY) : null);
}

/** `remember = false` keeps the session for the current browser tab only. */
export function writeAuthToken(token: string, remember = true): void {
  clearAuthToken();
  if (remember && hasStorage('localStorage')) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else if (hasStorage('sessionStorage')) {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}

export function clearAuthToken(): void {
  if (hasStorage('localStorage')) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  if (hasStorage('sessionStorage')) {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

/** True when the token is a JWT whose `exp` claim is in the past. Opaque tokens (Sanctum) never expire client-side. */
export function isTokenExpired(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

/** Token if present and not expired, otherwise null. */
export function readValidAuthToken(): string | null {
  const token = readAuthToken();
  return token && !isTokenExpired(token) ? token : null;
}