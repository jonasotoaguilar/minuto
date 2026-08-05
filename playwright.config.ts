import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081';
const startCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ??
  'pnpm exec expo start --web --port 8081';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/seed/global-setup.ts',
  outputDir: '/tmp/minuto-e2e-results',
  // Covers the cold first-bundle compile of the Expo dev server on CI.
  timeout: 60_000,
  workers: 1, // serial: parallel boots race the dev server and flake
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    colorScheme: 'light',
    trace: 'on-first-retry',
  },
  webServer: {
    command: startCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
