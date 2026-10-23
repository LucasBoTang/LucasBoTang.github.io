import { expect, test, type Page } from '@playwright/test';
import { routes } from '../../src/data/navigation';

// The motion's cost, kept from creeping back. The first checks count work the page should never
// do, so they hold on any machine. The last measure time on a CPU slowed four times, as an ordinary
// laptop or phone runs, so they run locally only: shared CI machines time too unevenly.

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

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
  await page.waitForTimeout(6000);
  await page.evaluate(() => ((window as unknown as { specks: number }).specks = 0));
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => (window as unknown as { specks: number }).specks)).toBe(0);
});

test('a wordmark trembles without laying the page out again', async ({ page }) => {
  await page.goto(routes.software);
  // Past the entries' arrivals and the wordmarks' power-on, which place their beams once.
  await page.waitForTimeout(8000);
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

  test('scrolling the home page to its foot raises no long task', async ({ page }) => {
    const session = await page.context().newCDPSession(page);
    await page.goto(routes.home);
    await page.waitForTimeout(6000);
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
    await page.waitForTimeout(12000);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const read = await metrics(page);
    const before = await read();
    await page.waitForTimeout(4000);
    const after = await read();
    // About 0.07s of script in these four seconds today; the budget leaves room for a slow run.
    expect(after.ScriptDuration - before.ScriptDuration).toBeLessThan(0.3);
  });
});
