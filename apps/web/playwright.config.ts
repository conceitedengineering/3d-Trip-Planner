import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: {
      args: ['--use-gl=egl'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    cwd: process.cwd(),
  },
});
