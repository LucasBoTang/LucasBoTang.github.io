import { expect, test, type Page } from '@playwright/test';
import { routes } from '../../src/data/navigation';
import { figureVersion } from '../../src/data/research/figure-version';
import { figureWarmups } from '../../src/data/research/figures';

// Each figure document is drawn once in an unseen slot, so the GPU has compiled its shaders before
// the figure first appears: on Research while its introduction types and its body waits, on Home
// one at a time once the opening has settled.

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

test('Research draws its figures while the introduction types, before the body arrives', async ({
  page,
}) => {
  await recordWarmup(page);
  await page.goto(routes.research);
  await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', /.*/);
  // Each figure is drawn ahead, here or at a later quiet moment, and remembered.
  await expect
    .poll(async () => (await remembered(page)).sort(), { timeout: 20_000 })
    .toEqual(everyFigure);
  const { gateLifted, typingStarted, slots } = await warmup(page);
  const [first] = slots;
  if (first?.sources.length === figureWarmups.length) {
    expect(first.at, 'while the introduction types').toBeGreaterThan(typingStarted!);
    expect(first.at, 'before the body arrives').toBeLessThan(gateLifted!);
  } else {
    // A page ready too late to hold its body back (here, under many parallel workers) leaves the
    // figures to quiet moments after it, one at a time.
    for (const slot of slots) {
      expect(slot.at).toBeGreaterThan(gateLifted!);
      expect(slot.sources).toHaveLength(1);
    }
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
