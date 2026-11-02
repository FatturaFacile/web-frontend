import { environment } from '@env';

/**
 * Reads a cookie value by name from `document.cookie` and decodes URI components.
 * Laravel Sanctum sets the `XSRF-TOKEN` cookie URL-encoded.
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
 * For absolute URLs (e.g. `https://dev-api.fatturafacile.eu/api/v1`), returns origin `https://dev-api.fatturafacile.eu`.
 * For relative URLs, returns an empty string so paths remain relative.
 */
export function getSanctumBaseUrl(): string {
  const base = environment.apiBaseUrl ?? environment.apiUrl ?? environment.baseUrl ?? '';
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
 * Typically `GET /sanctum/csrf-cookie` (or prefixed by backend origin if absolute).
 */
export function getCsrfCookieUrl(): string {
  const origin = getSanctumBaseUrl();
  return origin ? `${origin}/sanctum/csrf-cookie` : '/sanctum/csrf-cookie';
}

/**
 * Determines whether an outgoing HTTP request targets the Laravel backend API.
 * Static frontend assets (`/assets/...`) and external 3rd-party origins are excluded.
 */
export function isBackendApiRequest(url: string): boolean {
  if (!url || url.startsWith('/assets/')) {
    return false;
  }

  // 1. If absolute URL, check against backend origin candidates
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const backendOrigin = getSanctumBaseUrl();
    if (backendOrigin && url.startsWith(backendOrigin)) {
      return true;
    }
    // Check known default dev/api origins
    if (
      url.startsWith('https://dev-api.fatturafacile.eu') ||
      url.startsWith('http://dev-api.fatturafacile.eu')
    ) {
      return true;
    }
    // Any other absolute URL is considered a third-party request
    return false;
  }

  // 2. Relative URLs targeting backend endpoints
  return (
    url.startsWith('/api') ||
    url.includes('/sanctum/') ||
    url.startsWith('/login') ||
    url.startsWith('/logout') ||
    (Boolean(environment.apiBaseUrl) && url.startsWith(environment.apiBaseUrl)) ||
    (Boolean(environment.apiUrl) && url.startsWith(environment.apiUrl))
  );
}
