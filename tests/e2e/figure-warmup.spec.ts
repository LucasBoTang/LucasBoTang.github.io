import { expect, test, type Page } from '@playwright/test';
import { routes } from '../../src/data/navigation';
import { figureWarmups } from '../../src/data/research/figures';

// Before a page with figures opens, each figure document is drawn once in an unseen slot, so the
// GPU has compiled its shaders before the figure first appears; the opening waits for it.

// A first visit: the other specs start as a returning visitor (playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] } });

interface WarmupRecord {
  added: number | null;
  removed: number | null;
  sources: string[];
  gateLifted: number | null;
}

/** Records, from before the page's scripts run, when the warm-up slot comes and goes. */
async function recordWarmup(page: Page) {
  await page.addInitScript(() => {
    const record: WarmupRecord = { added: null, removed: null, sources: [], gateLifted: null };
    (window as unknown as { warmup: WarmupRecord }).warmup = record;
    new MutationObserver((changes) => {
      for (const change of changes) {
        if (
          change.type === 'attributes' &&
          !document.documentElement.hasAttribute('data-opening-pending')
        )
          record.gateLifted ??= Math.round(performance.now());
        for (const node of change.addedNodes)
          if (node instanceof Element && node.hasAttribute('data-figure-warmup')) {
            record.added = Math.round(performance.now());
            record.sources = [...node.querySelectorAll('iframe')].map(
              (frame) => frame.getAttribute('src') ?? '',
            );
          }
        for (const node of change.removedNodes)
          if (node instanceof Element && node.hasAttribute('data-figure-warmup'))
            record.removed = Math.round(performance.now());
      }
      // The document itself: at this point the page's root element does not exist yet.
    }).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-opening-pending'],
    });
  });
}
const warmup = (page: Page) =>
  page.evaluate(() => (window as unknown as { warmup: WarmupRecord }).warmup);

test('Research draws its figures ahead, and opens only once they are drawn', async ({ page }) => {
  await recordWarmup(page);
  await page.goto(routes.research);
  await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', /.*/, {
    timeout: 6000,
  });
  await expect.poll(async () => (await warmup(page)).removed).not.toBeNull();
  const record = await warmup(page);
  expect(record.sources).toEqual(figureWarmups.map((figure) => figure.src));
  expect(record.removed!).toBeLessThanOrEqual(record.gateLifted! + 50);
  await expect(page.locator('[data-figure-warmup]')).toHaveCount(0);

  // The browser now keeps the programs, so a later visit opens without drawing anything ahead.
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', /.*/, {
    timeout: 6000,
  });
  expect((await warmup(page)).added).toBeNull();
});

test('Home draws its previews ahead on a screen with hover', async ({ page }) => {
  await recordWarmup(page);
  await page.goto(routes.home);
  await expect.poll(async () => (await warmup(page)).removed, { timeout: 8000 }).not.toBeNull();
  expect((await warmup(page)).sources).toHaveLength(figureWarmups.length);
});

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('Home draws nothing ahead, since previews open on hover', async ({ page }) => {
    await recordWarmup(page);
    await page.goto(routes.home);
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', /.*/, {
      timeout: 6000,
    });
    expect((await warmup(page)).added).toBeNull();
  });
});
