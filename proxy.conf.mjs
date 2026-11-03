// Dev-server proxy: /api and /sanctum are forwarded to API_PROXY_TARGET, so the app stays same-origin and
// Sanctum cookie authentication works on localhost. scripts/ng-env.mjs sets API_PROXY_TARGET from
// env/<configuration>.env, .env or the shell (see README "Environment configuration").
const target = process.env.API_PROXY_TARGET;

if (!target) {
  throw new Error(
    'API_PROXY_TARGET is not set: start the dev server with `pnpm start` or `pnpm run start:local`.',
  );
}

const route = {
  target,
  secure: true,
  changeOrigin: true,
  cookieDomainRewrite: '',
  cookiePathRewrite: '/',
  headers: {
    'X-Forwarded-Host': 'localhost:4200',
    'X-Forwarded-Proto': 'https',
  },
};

export default {
  '/api': route,
  '/sanctum': { ...route },
};
