import { expect, test, type Page } from '@playwright/test';
import { figureVersion } from '../../scripts/figure-version.mjs';
import { figurePaths, figureWarmups } from '../../src/data/research/figures';
import { trackVisit, visitReport } from '../helpers/visit-metrics';

test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } });

type DrawAudit = {
  release: boolean;
  queried: boolean;
  loaded: boolean;
  drawn: boolean;
  previewStartedDuringWarmup: boolean;
  previewDrawn: boolean;
  previewDrawnAt: number;
  previewHandoverAt: number;
};
type AuditWindow = Window & { drawAudit: DrawAudit };
const key = `${figurePaths.l2o}#${figureVersion}`;
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('figure-warmup') ?? '[]') as string[]);

async function holdCompiler(page: Page) {
  await page.addInitScript(
    ({ cached }) => {
      const host = window.top as AuditWindow;
      if (window === window.top) {
        host.drawAudit = {
          release: false,
          queried: false,
          loaded: false,
          drawn: false,
          previewStartedDuringWarmup: false,
          previewDrawn: false,
          previewDrawnAt: 0,
          previewHandoverAt: 0,
        };
        new MutationObserver(() => {
          if (
            !host.drawAudit.previewHandoverAt &&
            document.querySelector('[data-preview-visible]:not([data-preview-pending])')
          )
            host.drawAudit.previewHandoverAt = performance.now();
        }).observe(document, {
          subtree: true,
          attributes: true,
          attributeFilter: ['data-preview-visible', 'data-preview-pending'],
        });
        localStorage.setItem('figure-warmup', JSON.stringify(cached));
        return;
      }
      if (window.frameElement?.closest('[data-figure-preview]')) {
        host.drawAudit.previewStartedDuringWarmup = Boolean(
          host.document.querySelector('[data-figure-warmup] iframe'),
        );
        document.addEventListener(
          'l2o:tick',
          () => {
            host.drawAudit.previewDrawn = true;
            host.drawAudit.previewDrawnAt = host.performance.now();
          },
          { capture: true, once: true },
        );
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

for (const slowed of [false, true]) {
  test(
    `opening a preview during unfinished warm-up${slowed ? ' on a slowed CPU' : ''}`,
    { tag: slowed ? '@timing' : [] },
    async ({ page }, info) => {
      test.skip(
        slowed && !!process.env.CI,
        'Shared CI machines cannot provide stable time budgets',
      );
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await trackVisit(page, slowed ? 4 : 1);
      await holdCompiler(page);
      const preview = page.locator(`[data-figure-preview][data-preview-src="${figurePaths.l2o}"]`);
      const interactionStartEpochMs = await page.evaluate(
        () => performance.timeOrigin + performance.now(),
      );
      const started = performance.now();
      await preview.hover();
      await expect
        .poll(() =>
          page.evaluate(
            () => (window as unknown as AuditWindow).drawAudit.previewStartedDuringWarmup,
          ),
        )
        .toBe(true);
      await expect(preview).toHaveAttribute('data-preview-visible', '', { timeout: 10000 });
      await expect(preview).not.toHaveAttribute('data-preview-pending', '', { timeout: 10000 });
      await expect
        .poll(() => page.evaluate(() => (window as unknown as AuditWindow).drawAudit.previewDrawn))
        .toBe(true);
      const previewReadyMs = Math.round(performance.now() - started);
      await expect(preview.locator('iframe')).toHaveCount(1);
      // The stalled hidden document can expire without removing the user's live preview.
      await expect(page.locator('[data-figure-warmup]')).toHaveCount(0, { timeout: 6500 });
      await expect(preview).toHaveAttribute('data-preview-visible', '');
      await expect(preview.locator('iframe')).toHaveCount(1);
      const blankAfterHandoverMs = await page.evaluate(() => {
        const audit = (window as unknown as AuditWindow).drawAudit;
        return Math.round(Math.max(0, audit.previewDrawnAt - audit.previewHandoverAt));
      });
      const report = await visitReport(page, info, {
        scenario: 'preview during stalled warm-up',
        cpuRate: slowed ? 4 : 1,
        previewReadyMs,
        interactionStartEpochMs,
        blankAfterHandoverMs,
      });
      if (slowed)
        expect(report.maxInteractionTask, 'preview interaction long-task budget').toBeLessThan(200);
      expect(blankAfterHandoverMs, 'handover must wait for the first drawing').toBe(0);
      expect(errors).toEqual([]);
    },
  );
}

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
