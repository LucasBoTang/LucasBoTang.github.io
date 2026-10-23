import { expect, test, type Page } from '@playwright/test';
import { routes } from '../../src/data/navigation';
import { figureVersion } from '../../src/data/research/figure-version';
import { figureWarmups } from '../../src/data/research/figures';

// Once a page's opening has settled, each figure document is drawn once, one at a time, in an
// unseen slot, so the GPU has compiled its shaders before the figure first appears. None of it
// delays the opening.

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
    (window as unknown as { warmup: WarmupRecord }).warmup = record;
    new MutationObserver((changes) => {
      const now = Math.round(performance.now());
      if (!document.documentElement.hasAttribute('data-opening-pending')) record.gateLifted ??= now;
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

test('Research opens at once, then draws its figures ahead one at a time', async ({ page }) => {
  await recordWarmup(page);
  await page.goto(routes.research);
  await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', /.*/);
  // Each figure is drawn ahead, or shown by the page itself, and remembered either way.
  await expect
    .poll(async () => (await remembered(page)).sort(), { timeout: 20_000 })
    .toEqual(everyFigure);
  const record = await warmup(page);
  for (const slot of record.slots) {
    expect(slot.at, 'drawn only once the opening is visible').toBeGreaterThan(record.gateLifted!);
    expect(slot.sources, 'one figure at a time').toHaveLength(1);
  }
  await expect(page.locator('[data-figure-warmup]')).toHaveCount(0);

  // The browser now keeps the programs, so a later visit draws nothing ahead.
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', /.*/);
  await page.waitForTimeout(3000);
  expect((await warmup(page)).slots).toEqual([]);
});

test('Home types its greeting first, then draws its previews ahead on a screen with hover', async ({
  page,
}) => {
  await recordWarmup(page);
  await page.goto(routes.home);
  await expect
    .poll(async () => (await remembered(page)).sort(), { timeout: 30_000 })
    .toEqual(everyFigure);
  const record = await warmup(page);
  expect(record.typingStarted).not.toBeNull();
  expect(record.slots).toHaveLength(figureWarmups.length);
  for (const slot of record.slots) expect(slot.at).toBeGreaterThan(record.typingStarted!);
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
