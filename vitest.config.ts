import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { fileParallelism: false, include: ['packages/**/*.test.ts', 'apps/engine/**/*.test.ts', 'apps/mobile/src/**/*.test.ts', 'tests/**/*.test.ts'], exclude: ['**/node_modules/**', '**/dist/**', '**/dist-native/**', 'tests/database/live.test.ts'], testTimeout: 20_000, hookTimeout: 30_000 } });
