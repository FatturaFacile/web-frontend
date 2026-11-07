import { defineConfig, devices } from '@playwright/test';

const PORT = 4200;
const BASE_URL = `https://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    locale: 'it-IT',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // The dev server runs over HTTPS with a local self-signed certificate (see angular.json / certs/README.md).
  // Starts the Angular dev server (through the repo's env wrapper) unless one is already running.
  webServer: {
    command: 'pnpm start',
    url: BASE_URL,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});

