import { expect, test } from '@playwright/test';
import { routes } from '../../src/data/navigation';

test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } });
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
