import { configDefaults, defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
    pool: 'forks',
    // Playwright E2E specs live in tests/ and e2e/ and must not be run by Vitest
    // Agent worktrees under .claude/ hold full repo copies and must not be collected either
    exclude: [...configDefaults.exclude, 'tests/**', 'e2e/**', '.claude/**'],
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 55,
        statements: 70,
      },
      exclude: [
        'coverage/**',
        'dist/**',
        '**/[.]**',
        '**/*.d.ts',
        'src/environments/**',
        'src/main.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@core': resolve(import.meta.dirname, './src/app/core'),
      '@domain': resolve(import.meta.dirname, './src/app/domain'),
      '@data-access': resolve(import.meta.dirname, './src/app/data-access'),
      '@shared': resolve(import.meta.dirname, './src/app/shared'),
      '@features': resolve(import.meta.dirname, './src/app/features'),
      '@env': resolve(import.meta.dirname, './src/environments/environment.ts'),
    },
  },
});
