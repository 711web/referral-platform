import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.smoke.test.ts',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? 'http://localhost:3000',
    extraHTTPHeaders: { 'user-agent': 'playwright-smoke' },
  },
  webServer: process.env.SMOKE_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        port: 3000,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
