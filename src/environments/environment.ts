// Values are injected at build time with `--define` by scripts/ng-env.mjs, which reads them from
// env/<configuration>.env, a local .env or the process environment (see README "Environment configuration").
// The fallbacks only apply when the CLI runs without the wrapper (e.g. Vitest).
declare const NG_APP_API_BASE_URL: string | undefined;
declare const NG_APP_DEMO_MODE: boolean | undefined;
declare const NG_APP_TERMS_URL: string | undefined;
declare const NG_APP_PRIVACY_URL: string | undefined;

export const environment = {
  demoMode: typeof NG_APP_DEMO_MODE === 'undefined' ? false : NG_APP_DEMO_MODE,
  apiBaseUrl: typeof NG_APP_API_BASE_URL === 'undefined' ? '/api/v1' : NG_APP_API_BASE_URL,
  termsUrl: typeof NG_APP_TERMS_URL === 'undefined' ? '' : NG_APP_TERMS_URL,
  privacyUrl: typeof NG_APP_PRIVACY_URL === 'undefined' ? '' : NG_APP_PRIVACY_URL,
};
