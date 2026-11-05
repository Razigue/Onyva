import { defineConfig } from '@playwright/test';

process.loadEnvFile('.env');
process.loadEnvFile('apps/mobile/.env.local');

export default defineConfig({
  testDir: './tests/live', timeout: 120_000, workers: 1,
  // Authenticated sessions must never be captured in a Playwright trace.
  use: { baseURL: 'http://localhost:8083', trace: 'off', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  webServer: { command: 'pnpm --filter mobile exec expo start --web --port 8083', url: 'http://localhost:8083', reuseExistingServer: true, timeout: 120_000 },
});
