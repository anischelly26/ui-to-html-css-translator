import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.FORM_TEST_BASE_URL || 'http://127.0.0.1:8000';
const key = process.env.FORM_TEST_KEY || 'ci-fixture-key';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8000 },
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: process.env.FORM_TEST_BASE_URL ? undefined : {
    command: 'python -m uvicorn studio.api:app --host 127.0.0.1 --port 8000',
    cwd: '..', url: `${baseURL}/api/health`,
    env: { FORM_API_KEY: key }, reuseExistingServer: !process.env.CI,
  },
});
