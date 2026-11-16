import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Accessibility audit only (tests/accessibility*.spec.ts), Chromium. Run with `pnpm e2e:a11y`.
export default defineConfig({
  ...base,
  testDir: './tests',
  testMatch: /accessibility.*\.spec\.ts/,
  projects: [base.projects![0]],
});
