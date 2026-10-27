import { environment } from '@env';

/**
 * Reads a cookie value by name from `document.cookie` and decodes URI components.
 * Laravel sets the `XSRF-TOKEN` cookie URL-encoded.
 */
export function getXsrfCookie(name = 'XSRF-TOKEN'): string | null {
  if (typeof document === 'undefined' || !document.cookie) {
    return null;
  }
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Resolves the base origin of the Laravel backend.
 * For absolute URLs (e.g. `https://api.fatturafacile.eu/api/v1`), returns origin `https://api.fatturafacile.eu`.
 * For relative URLs, returns an empty string so paths remain relative.
 */
export function getSanctumBaseUrl(): string {
  const base = environment.apiBaseUrl ?? '';
  if (base.startsWith('http://') || base.startsWith('https://')) {
    try {
      return new URL(base).origin;
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Returns the fully qualified or relative URL to the Laravel Sanctum CSRF cookie initialization endpoint.
 * Typically `GET /sanctum/csrf-cookie`.
 */
export function getCsrfCookieUrl(): string {
  const origin = getSanctumBaseUrl();
  return origin ? `${origin}/sanctum/csrf-cookie` : '/sanctum/csrf-cookie';
}

/**
 * Determines whether an outgoing HTTP request targets the Laravel backend API.
 * Static frontend assets (`/assets/...`) are excluded.
 */
export function isBackendApiRequest(url: string): boolean {
  if (url.startsWith('/assets/')) {
    return false;
  }

  const backendOrigin = getSanctumBaseUrl();
  if (backendOrigin && url.startsWith(backendOrigin)) {
    return true;
  }

  return (
    url.startsWith(environment.apiBaseUrl) ||
    url.startsWith('/api') ||
    url.startsWith(environment.apiUrl) ||
    url.includes('/sanctum/')
  );
}
