import { defineConfig } from '@playwright/test';
import { figureVersion } from './scripts/figure-version.mjs';
import { figureWarmups } from './src/data/research/figures';

// Another checkout running its own tests may hold the default port; set PLAYWRIGHT_PORT to keep
// apart, since a server already listening there is reused.
const port = Number(process.env.PLAYWRIGHT_PORT) || 4400;
const baseURL = `http://127.0.0.1:${port}`;

// A first visit draws every figure ahead once the opening has settled (FigureWarmup), which,
// under software rendering and many parallel workers, loads every page with three more documents
// and shifts the timing other specs measure. Tests start as a returning visitor whose figures are
// already drawn through; warm-up and first-visit specs start fresh.
const returningVisitor = {
  cookies: [],
  origins: [
    {
      origin: baseURL,
      localStorage: [
        {
          name: 'figure-warmup',
          value: JSON.stringify(figureWarmups.map(({ src }) => `${src}#${figureVersion}`)),
        },
      ],
    },
  ],
};

// `e2e` checks behaviour on every platform and runs in CI. `visual` compares screenshots with
// baselines rendered on the author's machine, so it runs locally only (font rendering differs).
export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    storageState: returningVisitor,
    // Locally, use the installed Chrome; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : 'chrome',
  },
  projects: [
    {
      name: 'e2e',
      grepInvert: /@timing/,
      testDir: './tests/e2e',
      // Playwright turns the back-forward cache off; the site's animations must survive it.
      use: { launchOptions: { ignoreDefaultArgs: ['--disable-back-forward-cache'] } },
    },
    {
      name: 'performance',
      testDir: './tests/e2e',
      testMatch: ['first-visit-performance.spec.ts', 'figure-drawn.spec.ts'],
      grep: /@timing/,
    },
    { name: 'visual', testDir: './tests/visual', use: { reducedMotion: 'reduce' } },
  ],
  webServer: {
    command: `npx astro build && npx astro preview --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
