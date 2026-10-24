import { expect, test } from '@playwright/test';
import { routes } from '../../src/data/navigation';
import { waitForOpening, metrics } from '../helpers/steady-motion';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

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
