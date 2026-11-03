// In development Vite proxies both paths to the backend (see vite.config.ts),
// so the Sanctum session cookie is first-party.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1"
export const CSRF_COOKIE_URL =
  import.meta.env.VITE_CSRF_COOKIE_URL ?? "/sanctum/csrf-cookie"

// Where a signed-in user lands, and where `/` leads.
export const HOME_PATH = "/dashboard"
export const LOGIN_PATH = "/login"
