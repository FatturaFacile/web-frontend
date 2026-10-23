import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
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
      '@core': resolve(__dirname, './src/app/core'),
      '@domain': resolve(__dirname, './src/app/domain'),
      '@data-access': resolve(__dirname, './src/app/data-access'),
      '@shared': resolve(__dirname, './src/app/shared'),
      '@features': resolve(__dirname, './src/app/features'),
      '@env': resolve(__dirname, './src/environments/environment.ts'),
    },
  },
});
