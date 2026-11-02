// dev.fatturafacile.eu: the API is served on the same origin (/api, /sanctum), see web-api deploy/dev/nginx.conf
export const environment = {
  production: true,
  demoMode: false,
  baseUrl: '',
  apiUrl: '/api/v1',
  apiBaseUrl: '/api/v1',
};
