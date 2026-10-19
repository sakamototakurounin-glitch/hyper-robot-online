import { defineConfig, devices } from '@playwright/test';

// ローカルD1（.wrangler/）のみ使用。--remote は絶対に付けない。
export default defineConfig({
  testDir: 'e2e',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:8787' },
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx wrangler d1 migrations apply DB --local && npx wrangler dev --local --ip 127.0.0.1 --port 8787',
    url: 'http://127.0.0.1:8787',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
