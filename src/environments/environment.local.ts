// Local development against a backend running on http://localhost:8000 (php artisan serve or Sail).
// Requests stay same-origin and go through the dev-server proxy (proxy.conf.json), so Sanctum cookies work.
export const environment = {
  production: false,
  demoMode: false,
  apiUrl: '/api',
  apiBaseUrl: '/api/v1',
};
