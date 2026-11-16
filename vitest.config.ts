import { configDefaults, defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
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
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
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
      '@core': resolve(__dirname, './src/app/core'),
      '@domain': resolve(__dirname, './src/app/domain'),
      '@data-access': resolve(__dirname, './src/app/data-access'),
      '@shared': resolve(__dirname, './src/app/shared'),
      '@features': resolve(__dirname, './src/app/features'),
      '@env': resolve(__dirname, './src/environments/environment.ts'),
    },
  },
});
