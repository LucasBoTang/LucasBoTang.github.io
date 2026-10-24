import { expect, test, type Page } from '@playwright/test';
import { figureVersion } from '../../scripts/figure-version.mjs';
import { figurePaths, figureWarmups } from '../../src/data/research/figures';

test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } });

type DrawAudit = { release: boolean; queried: boolean; loaded: boolean; drawn: boolean };
type AuditWindow = Window & { drawAudit: DrawAudit };
const key = `${figurePaths.l2o}#${figureVersion}`;
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('figure-warmup') ?? '[]') as string[]);

async function holdCompiler(page: Page) {
  await page.addInitScript(
    ({ cached }) => {
      const host = window.top as AuditWindow;
      if (window === window.top) {
        host.drawAudit = { release: false, queried: false, loaded: false, drawn: false };
        localStorage.setItem('figure-warmup', JSON.stringify(cached));
        return;
      }
      if (!window.frameElement?.closest('[data-figure-warmup]')) return;
      const extension = WebGLRenderingContext.prototype.getExtension;
      WebGLRenderingContext.prototype.getExtension = new Proxy(extension, {
        apply(target, receiver, args) {
          return args[0] === 'KHR_parallel_shader_compile'
            ? { COMPLETION_STATUS_KHR: 0x91b1 }
            : Reflect.apply(target, receiver, args);
        },
      });
      const query = WebGLRenderingContext.prototype.getProgramParameter;
      WebGLRenderingContext.prototype.getProgramParameter = new Proxy(query, {
        apply(target, receiver, args) {
          if (args[1] === 0x91b1) {
            host.drawAudit.queried = true;
            return host.drawAudit.release;
          }
          return Reflect.apply(target, receiver, args);
        },
      });
      addEventListener(
        'load',
        () => {
          host.drawAudit.loaded = true;
        },
        { once: true },
      );
      document.addEventListener(
        'l2o:tick',
        () => {
          host.drawAudit.drawn = true;
        },
        { capture: true, once: true },
      );
    },
    {
      cached: figureWarmups
        .filter(({ src }) => src !== figurePaths.l2o)
        .map(({ src }) => `${src}#${figureVersion}`),
    },
  );
  await page.goto('/');
  await page.waitForFunction(() => {
    const audit = (window as unknown as AuditWindow).drawAudit;
    return audit.loaded && audit.queried;
  });
}

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
