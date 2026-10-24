import { expect, test, type Page } from '@playwright/test';
import { figureVersion } from '../../scripts/figure-version.mjs';
import { figurePaths } from '../../src/data/research/figures';
import { holdCompiler, type AuditWindow } from '../helpers/figure-drawing';
import { expectPreviewDuringWarmup } from '../helpers/preview-during-warmup';

test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } });

const key = `${figurePaths.l2o}#${figureVersion}`;
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('figure-warmup') ?? '[]') as string[]);

test('a loaded figure waits for actual drawing before its warm-up can succeed', async ({
  page,
}) => {
  await holdCompiler(page);
  await page.evaluate(async () => {
    for (let i = 0; i < 40; i++)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  expect(await saved(page)).not.toContain(key);
  expect(await page.evaluate(() => (window as unknown as AuditWindow).drawAudit.drawn)).toBe(false);
  await expect(page.locator('[data-figure-warmup] iframe')).toHaveCount(1);
  await page.evaluate(() => {
    (window as unknown as AuditWindow).drawAudit.release = true;
  });
  await expect.poll(() => saved(page), { timeout: 10000 }).toContain(key);
  expect(await page.evaluate(() => (window as unknown as AuditWindow).drawAudit.drawn)).toBe(true);
  await expect(page.locator('[data-figure-warmup]')).toHaveCount(0);
});

test('a stalled drawing times out without a successful warm-up record', async ({ page }) => {
  await holdCompiler(page);
  await expect(page.locator('[data-figure-warmup]')).toHaveCount(0, { timeout: 6500 });
  expect(await saved(page)).not.toContain(key);
  expect(await page.evaluate(() => (window as unknown as AuditWindow).drawAudit.drawn)).toBe(false);
  await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '');
});

test('a partially unavailable canvas figure never reports a complete drawing', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = new Proxy(getContext, {
      apply(target, receiver, args) {
        if (receiver.dataset.module === 'predict' && args[0] === '2d') return null;
        return Reflect.apply(target, receiver, args);
      },
    });
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = new Proxy(stroke, {
      apply(target, receiver, args) {
        document.documentElement.setAttribute('data-test-other-draw', '');
        return Reflect.apply(target, receiver, args);
      },
    });
  });
  await page.goto(figurePaths.dfl);
  await expect(page.locator('html')).toHaveAttribute('data-test-other-draw', '');
  await expect(page.locator('.dfl-composition')).toHaveAttribute('data-figure-drawn', 'pending');
});

test('opening a preview during unfinished warm-up', async ({ page }) => {
  await expectPreviewDuringWarmup(page);
});

test('a preview without WebGL presents its fallback without recording a successful warm-up', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = new Proxy(getContext, {
      apply(target, receiver, args) {
        if (String(args[0]).includes('webgl')) return null;
        return Reflect.apply(target, receiver, args);
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '');
  const preview = page.locator(`[data-figure-preview][data-preview-src="${figurePaths.l2o}"]`);
  await preview.hover();
  await expect(preview).toHaveAttribute('data-preview-visible', '');
  await expect(preview).not.toHaveAttribute('data-preview-pending', '');
  await expect(preview.frameLocator('iframe').locator('.surface-fallback')).toBeVisible();
  await expect(preview.frameLocator('iframe').locator('[data-l2o-surface]')).toHaveAttribute(
    'data-figure-drawn',
    'fallback',
  );
  expect(await saved(page)).not.toContain(key);
});
