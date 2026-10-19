import { defineConfig } from '@playwright/test';

const port = 4400;

// `e2e` checks behaviour on every platform and runs in CI. `visual` compares screenshots with
// baselines rendered on the author's machine, so it runs locally only (font rendering differs).
export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    // Locally, use the installed Chrome; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : 'chrome',
  },
  projects: [
    {
      name: 'e2e',
      testDir: './tests/e2e',
      // Playwright turns the back-forward cache off; the site's animations must survive it.
      use: { launchOptions: { ignoreDefaultArgs: ['--disable-back-forward-cache'] } },
    },
    { name: 'visual', testDir: './tests/visual', use: { reducedMotion: 'reduce' } },
  ],
  webServer: {
    command: `npx astro build && npx astro preview --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
