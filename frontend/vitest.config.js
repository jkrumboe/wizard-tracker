/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
    css: true,
    exclude: [
      '**/e2e/**',
      '**/tests/e2e/**',
      '**/*.spec.js', // Exclude Playwright E2E tests
      '**/node_modules/@testing-library/jest-dom/**',
      '**/node_modules/@surma/rollup-plugin-off-main-thread/**',
      '**/node_modules/**/tests/**',
      '**/node_modules/**/__tests__/**',
      '**/node_modules/**/test/**',
      '**/node_modules/**/*.test.js',
      '**/node_modules/**/*.test.ts',
      '**/node_modules/**/*.spec.js',
      '**/node_modules/**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.config.js',
        '**/*.config.ts',
        'dist/',
        'coverage/',
        '**/e2e/**',
        '**/*.spec.js',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
