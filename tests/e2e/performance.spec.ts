import { expect, test, type Page } from '@playwright/test';
import { routes } from '../../src/data/navigation';

// The motion's cost, kept from creeping back. The first checks count work the page should never
// do, so they hold on any machine. The last measure time on a CPU slowed four times, as an ordinary
// laptop or phone runs, so they run locally only: shared CI machines time too unevenly.

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

/** Measure steady motion only after the opening, typing and visible entrances have finished. */
async function waitForOpening(page: Page) {
  await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '');
  const hero = page.locator('[data-home-motion]');
  if (await hero.count()) {
    await expect(hero).toHaveAttribute('data-opening-started', /.+/, { timeout: 8000 });
    await expect(hero).not.toHaveAttribute('data-opening', '', { timeout: 6000 });
    await expect(page.locator('.research-topic[data-connecting]')).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(page.locator('.hero-actions')).toHaveCSS('opacity', '1');
  } else {
    await expect(page.locator('.software-entry').first()).toHaveCSS('opacity', '1');
  }
  const passages = page.locator(
    '[data-home-motion] [data-typed-text], [data-page-intro] [data-typed-text]',
  );
  for (const passage of await passages.all())
    await expect(passage).toHaveAttribute('data-typing-complete', '', { timeout: 12000 });
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => {
      // Offscreen entrances remain paused; caret blinks and lane drift run indefinitely.
      if (animation.playState !== 'running' && !animation.pending) return true;
      if (!Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))) return true;
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (!(target instanceof Element)) return true;
      const box = target.getBoundingClientRect();
      return box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth;
    }),
  );
}

/** The browser's running totals, such as `LayoutCount` or `ScriptDuration`. */
async function metrics(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  return async () =>
    Object.fromEntries(
      (await session.send('Performance.getMetrics')).metrics.map(({ name, value }) => [
        name,
        value,
      ]),
    ) as Record<string, number>;
}

test('at rest, the portrait replays its snow rather than drawing it', async ({ page }) => {
  // Every speck the snow draws by hand is a `fillRect`; a tear (`data-slip`) may draw by hand.
  await page.addInitScript(() => {
    const fill = CanvasRenderingContext2D.prototype.fillRect;
    (window as unknown as { specks: number }).specks = 0;
    CanvasRenderingContext2D.prototype.fillRect = function (...args) {
      if (!document.querySelector('[data-home-motion][data-slip]'))
        (window as unknown as { specks: number }).specks++;
      return fill.apply(this, args);
    };
  });
  await page.goto(routes.home);
  await waitForOpening(page);
  await page.evaluate(() => ((window as unknown as { specks: number }).specks = 0));
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => (window as unknown as { specks: number }).specks)).toBe(0);
});

test('a wordmark trembles without laying the page out again', async ({ page }) => {
  await page.goto(routes.software);
  // Past the entries' arrivals and the wordmarks' power-on, which place their beams once.
  await waitForOpening(page);
  const read = await metrics(page);
  const tremors = page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let count = 0;
        new MutationObserver((records) => (count += records.length)).observe(document.body, {
          subtree: true,
          attributeFilter: ['data-torn'],
        });
        setTimeout(() => resolve(count), 4000);
      }),
  );
  const before = await read();
  const torn = await tremors;
  const after = await read();
  expect(torn, 'the wordmarks trembled while measured').toBeGreaterThan(0);
  // A page title's glitch may lay out its own line once.
  expect(after.LayoutCount - before.LayoutCount).toBeLessThanOrEqual(2);
});

test('every other page is fetched ahead, so moving to it waits for no network', async ({
  page,
}) => {
  const fetched = new Set<string>();
  page.on('requestfinished', (request) => fetched.add(new URL(request.url()).pathname));
  await page.goto(routes.research);
  const others = Object.values(routes).filter((route) => route !== routes.research);
  await expect.poll(() => others.filter((route) => !fetched.has(route))).toEqual([]);
  await page.locator(`nav a[href="${routes.software}"]`).click();
  await page.waitForURL(`**${routes.software}`);
  const { transferSize, encodedBodySize } = await page.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return { transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize };
  });
  // The page's body comes from the cache; at most its headers cross the network, where the
  // server asks the browser to check that its copy is still current.
  expect(transferSize, 'the page came from the cache').toBeLessThan(encodedBodySize);
});

test('the pixel picture is fetched from the start, not once the opening asks for it', async ({
  page,
}) => {
  await page.goto(routes.home);
  const pixels = await page.locator('[data-portrait-develop]').getAttribute('data-portrait-pixels');
  await expect(page.locator(`link[rel="preload"][as="image"][href="${pixels}"]`)).toHaveCount(1);
});

test.describe('on a slowed CPU', () => {
  test.skip(!!process.env.CI, 'Shared CI machines time too unevenly');

  test('scrolling the home page to its foot keeps tasks within 150ms', async ({ page }) => {
    const session = await page.context().newCDPSession(page);
    await page.goto(routes.home);
    await waitForOpening(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => {
      const long: number[] = [];
      (window as unknown as { long: number[] }).long = long;
      new PerformanceObserver((list) =>
        list.getEntries().forEach((entry) => long.push(Math.round(entry.duration))),
      ).observe({ type: 'longtask' });
    });
    for (let step = 0; step < 40; step++) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(500);
    const long = await page.evaluate(() => (window as unknown as { long: number[] }).long);
    expect(long.filter((duration) => duration > 150)).toEqual([]);
  });

  test('the home page at rest keeps its scripts light', async ({ page }) => {
    const session = await page.context().newCDPSession(page);
    await page.goto(routes.home);
    await waitForOpening(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const read = await metrics(page);
    const before = await read();
    await page.waitForTimeout(4000);
    const after = await read();
    // About 0.07s of script in these four seconds today; the budget leaves room for a slow run.
    expect(after.ScriptDuration - before.ScriptDuration).toBeLessThan(0.3);
  });
});
