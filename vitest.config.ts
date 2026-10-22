import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
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
      '@core': resolve(__dirname, './src/app/core/index.ts'),
      '@core/': resolve(__dirname, './src/app/core') + '/',
      '@domain': resolve(__dirname, './src/app/domain/index.ts'),
      '@domain/': resolve(__dirname, './src/app/domain') + '/',
      '@data-access': resolve(__dirname, './src/app/data-access/index.ts'),
      '@data-access/': resolve(__dirname, './src/app/data-access') + '/',
      '@shared': resolve(__dirname, './src/app/shared/index.ts'),
      '@shared/': resolve(__dirname, './src/app/shared') + '/',
      '@features/': resolve(__dirname, './src/app/features') + '/',
      '@env': resolve(__dirname, './src/environments/environment.ts'),
    },
  },
});
