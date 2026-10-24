import { expect, test, type Page } from '@playwright/test';
import { figureVersion } from '../../scripts/figure-version.mjs';
import { routes } from '../../src/data/navigation';
import { figureWarmups } from '../../src/data/research/figures';

// First visits warm figures serially after the opening; later visits reuse the cache.

// A first visit: the other specs start as a returning visitor (playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] } });

interface WarmupRecord {
  gateLifted: number | null;
  typingStarted: number | null;
  slots: { at: number; sources: string[] }[];
}

/** Records, from before the page's scripts run, the opening and each warm-up slot. */
async function recordWarmup(page: Page) {
  await page.addInitScript(() => {
    const record: WarmupRecord = { gateLifted: null, typingStarted: null, slots: [] };
    let pending = false;
    (window as unknown as { warmup: WarmupRecord }).warmup = record;
    new MutationObserver((changes) => {
      const now = Math.round(performance.now());
      // The gate is set from a script in the head, so it counts as lifted only once it was seen.
      if (document.documentElement?.hasAttribute('data-opening-pending')) pending = true;
      else if (pending) record.gateLifted ??= now;
      if (document.querySelector('[data-typing-started]')) record.typingStarted ??= now;
      for (const change of changes)
        for (const node of change.addedNodes)
          if (node instanceof Element && node.hasAttribute('data-figure-warmup'))
            record.slots.push({
              at: now,
              sources: [...node.querySelectorAll('iframe')].map((frame) => frame.src),
            });
      // The document itself: at this point the page's root element does not exist yet.
    }).observe(document, { childList: true, subtree: true, attributes: true });
  });
}
const warmup = (page: Page) =>
  page.evaluate(() => (window as unknown as { warmup: WarmupRecord }).warmup);
const remembered = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('figure-warmup') ?? '[]') as string[]);
const everyFigure = figureWarmups.map(({ src }) => `${src}#${figureVersion}`).sort();

/** Warm-up must neither hold the opening nor load several hidden figures together. */
async function expectIdleWarmup(page: Page) {
  await expect.poll(async () => (await warmup(page)).typingStarted).not.toBeNull();
  await expect
    .poll(async () => (await remembered(page)).sort(), { timeout: 30_000 })
    .toEqual(everyFigure);
  const { gateLifted, typingStarted, slots } = await warmup(page);
  expect(gateLifted).not.toBeNull();
  for (const slot of slots) {
    expect(slot.at).toBeGreaterThan(gateLifted!);
    expect(slot.at).toBeGreaterThan(typingStarted!);
    expect(slot.sources).toHaveLength(1);
  }
  await expect(page.locator('[data-figure-warmup]')).toHaveCount(0);
}

test('Research warms figures after its introduction starts, only on a first visit', async ({
  page,
}) => {
  await recordWarmup(page);
  await page.goto(routes.research);
  await expectIdleWarmup(page);

  // The browser now keeps the programs, so a later visit draws nothing ahead.
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', /.*/);
  await page.waitForTimeout(3000);
  expect((await warmup(page)).slots).toEqual([]);
});

test('Home warms previews after its greeting starts on a screen with hover', async ({ page }) => {
  await recordWarmup(page);
  await page.goto(routes.home);
  await expectIdleWarmup(page);
});

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('Home draws nothing ahead, since previews open on hover', async ({ page }) => {
    await recordWarmup(page);
    await page.goto(routes.home);
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', /.*/);
    await page.waitForTimeout(3000);
    expect((await warmup(page)).slots).toEqual([]);
  });
});
