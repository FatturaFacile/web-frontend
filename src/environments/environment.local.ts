// Relative URLs: the dev server proxies /api and /sanctum (proxy.conf.json), so requests
// stay same-origin and need neither CORS nor HTTPS. `baseUrl` is the page's own origin,
// where the CSRF refresh finds /sanctum/csrf-cookie.
export const environment = {
  production: false,
  demoMode: false,
  baseUrl: globalThis.location?.origin ?? '',
  apiUrl: '/api/v1',
  apiBaseUrl: '/api/v1',
};
