import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', testIgnore: '**/live/**', timeout: 60_000, use: { baseURL: 'http://localhost:8084', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
  webServer: [
    { command: 'pnpm --filter mobile exec expo start --web --port 8084', url: 'http://localhost:8084', reuseExistingServer: !process.env.CI, timeout: 120_000, env: { EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-public-key' } },
    { command: 'pnpm --filter invite exec vite --port 4175', url: 'http://localhost:4175', reuseExistingServer: !process.env.CI, timeout: 30000, env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'test-public-key', VITE_ANDROID_STORE_URL: 'https://play.google.com/store/apps/details?id=fr.onyva.app', VITE_IOS_STORE_URL: 'https://apps.apple.com/app/id0000000000' } },
  ],
});
