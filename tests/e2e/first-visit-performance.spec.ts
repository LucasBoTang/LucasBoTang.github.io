import { expect, test, type Page } from '@playwright/test';
import { routes } from '../../src/data/navigation';

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
