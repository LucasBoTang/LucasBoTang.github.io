import { expect, test, type Page } from '@playwright/test';
import { routes } from '../../src/data/navigation';
import { trackVisit, visitReport } from '../helpers/visit-metrics';

test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } });

async function recordTasks(page: Page) {
  await page.addInitScript(() => {
    const tasks: number[] = [];
    (window as unknown as { firstVisitTasks: number[] }).firstVisitTasks = tasks;
    new PerformanceObserver((list) =>
      tasks.push(...list.getEntries().map((entry) => entry.duration)),
    ).observe({ type: 'longtask', buffered: true });
  });
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

async function expectResponsiveOpening(page: Page) {
  await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '', {
    timeout: 5000,
  });
  await expect(page.locator('[data-typing-started]').first()).toBeAttached({ timeout: 5000 });
  // Include the opening and later speculative work, not just an already settled page.
  await page.waitForTimeout(10000);
  const tasks = await page.evaluate(
    () => (window as unknown as { firstVisitTasks: number[] }).firstVisitTasks,
  );
  expect(Math.max(0, ...tasks), 'first-visit main-thread task budget').toBeLessThan(200);
}

test.describe('first-visit time budgets', { tag: '@timing' }, () => {
  test.skip(!!process.env.CI, 'Shared CI machines cannot provide stable time budgets');
  for (const route of [routes.home, routes.research]) {
    test(`fresh ${route} stays responsive on a slowed CPU`, async ({ page }) => {
      await recordTasks(page);
      await page.goto(route);
      await expectResponsiveOpening(page);
    });
  }
  test('first navigation to Research stays responsive', async ({ page }) => {
    await recordTasks(page);
    await page.goto(routes.about);
    await page.locator(`.site-header a[href="${routes.research}"]`).click();
    await page.waitForURL(`**${routes.research}`);
    await expectResponsiveOpening(page);
  });
});

test('a first-visit preview loads without a preexisting warm-up cache', async ({ page }) => {
  await page.goto(routes.home);
  const link = page.locator('[data-figure-preview]').first();
  await link.hover();
  await expect(link).toHaveAttribute('data-preview-visible', '', { timeout: 15000 });
  await expect(link.locator('iframe')).toHaveCount(1);
  await expect(link).not.toHaveAttribute('data-preview-pending', '', { timeout: 5000 });
});

test('surface drawing works without parallel shader compilation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const getExtension = WebGLRenderingContext.prototype.getExtension;
    WebGLRenderingContext.prototype.getExtension = new Proxy(getExtension, {
      apply(target, receiver, args) {
        return args[0] === 'KHR_parallel_shader_compile'
          ? null
          : Reflect.apply(target, receiver, args);
      },
    });
    document.addEventListener(
      'l2o:tick',
      () => document.documentElement.setAttribute('data-test-surface-drawn', ''),
      true,
    );
  });
  await page.goto('/figures/learning-integers/');
  await expect(page.locator('html')).toHaveAttribute('data-test-surface-drawn', '', {
    timeout: 15000,
  });
  expect(errors).toEqual([]);
});

test.describe('cold-cache weak-network visits', { tag: '@timing' }, () => {
  test.skip(!!process.env.CI, 'Shared CI machines cannot provide stable time budgets');
  test.setTimeout(60000);
  for (const route of [routes.home, routes.research]) {
    test(`cold ${route} remains responsive with slow downloads`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const session = await trackVisit(page);
      await session.send('Network.enable');
      await session.send('Network.clearBrowserCache');
      await session.send('Network.setCacheDisabled', { cacheDisabled: true });
      // Repeatable cold loads: 150ms latency, 1.6Mbps down, 750Kbps up, and a 4x slower CPU.
      await session.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: 200000,
        uploadThroughput: 93750,
      });
      let cachedResponses = 0;
      let mainResponseSeen = false;
      let mainDocumentFromCache = false;
      session.on('Network.responseReceived', ({ type, response }) => {
        if (type !== 'Document' || new URL(response.url).pathname !== route) return;
        mainResponseSeen = true;
        mainDocumentFromCache = Boolean(
          response.fromDiskCache || response.fromPrefetchCache || response.fromServiceWorker,
        );
      });
      session.on('Network.requestServedFromCache', () => cachedResponses++);
      await page.goto(route);
      await expect(page.locator('[data-typing-started]').first()).toBeAttached({ timeout: 10000 });
      await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '', {
        timeout: 10000,
      });
      await page.waitForTimeout(12000);
      const report = await visitReport(page, info, {
        route,
        cpuRate: 4,
        latencyMs: 150,
        downMbps: 1.6,
        cacheDisabled: true,
        cachedResponses,
      });
      // Preloads can be reused within this visit; that does not make its initial navigation warm.
      expect(mainResponseSeen).toBe(true);
      expect(mainDocumentFromCache).toBe(false);
      expect(report.paints.some((paint) => paint.name === 'first-contentful-paint')).toBe(true);
      expect(report.maxTask, 'main page and child-document long-task budget').toBeLessThan(200);
      expect(errors).toEqual([]);
    });
  }
});
