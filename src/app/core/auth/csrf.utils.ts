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
 * For absolute URLs (e.g. `https://api.example.com/api/v1`), returns origin `https://api.example.com`.
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

  // 1. If absolute URL, only the configured backend origin counts as the API
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const backendOrigin = getSanctumBaseUrl();
    // Any other absolute URL is considered a third-party request
    return Boolean(backendOrigin) && url.startsWith(backendOrigin);
  }

  // 2. Relative URLs targeting backend endpoints
  return (
    url.startsWith('/api') ||
    url.includes('/sanctum/') ||
    url.startsWith('/login') ||
    url.startsWith('/logout') ||
    (Boolean(environment.apiBaseUrl) && url.startsWith(environment.apiBaseUrl))
  );
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.localhost');
}

/**
 * The app works over HTTPS only: the session cookie is `Secure`, so a request that would travel over plain HTTP
 * is refused before it leaves the browser. Loopback hosts (local development) are the only exception.
 *
 * Absolute URLs are judged by their own scheme; relative URLs by the scheme of the page that sends them.
 */
export function isInsecureBackendRequest(
  url: string,
  pageProtocol: string = typeof window === 'undefined' ? 'https:' : window.location.protocol,
  pageHostname: string = typeof window === 'undefined' ? '' : window.location.hostname,
): boolean {
  if (/^https:\/\//i.test(url)) {
    return false;
  }

  if (/^http:\/\//i.test(url)) {
    try {
      return !isLoopbackHost(new URL(url).hostname);
    } catch {
      return true;
    }
  }

  return pageProtocol === 'http:' && !isLoopbackHost(pageHostname);
}
