import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs on its own ports against the test database (app_test), so it never touches dev data
 * and can run next to `pnpm dev`. Ports can be overridden via E2E_WEB_PORT / E2E_API_PORT.
 */
const WEB_PORT = Number(process.env['E2E_WEB_PORT'] ?? 3200);
const API_PORT = Number(process.env['E2E_API_PORT'] ?? 4200);
const WEB_URL = `http://localhost:${WEB_PORT}`;
const API_URL = `http://localhost:${API_PORT}`;
const apiDir = path.resolve(__dirname, '../api');

// Loaded by the API from the root .env; these override it for the E2E servers only.
const testDatabaseUrl =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://app:app@localhost:55432/app_test?schema=public';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: WEB_URL,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Own output dir: `nest build` would wipe the dist/ a running `pnpm dev` serves from.
      command: 'pnpm exec tsc -p tsconfig.build.json --outDir dist-e2e && node dist-e2e/main.js',
      cwd: apiDir,
      url: `${API_URL}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn',
        API_PORT: String(API_PORT),
        APP_URL: WEB_URL,
        DATABASE_URL: testDatabaseUrl,
        // E2E opts in to a multi-seat plan so the invitation flow (acceptance #1) can run.
        SIGNUP_PLAN_CODE: 'growth',
      },
    },
    {
      command: `pnpm exec next dev --port ${WEB_PORT}`,
      cwd: __dirname,
      url: `${WEB_URL}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_URL, APP_URL: WEB_URL, NEXT_DIST_DIR: '.next-e2e' },
    },
  ],
});
