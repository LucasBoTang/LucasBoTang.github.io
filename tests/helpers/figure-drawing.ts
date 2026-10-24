import type { Page } from '@playwright/test';
import { figureVersion } from '../../scripts/figure-version.mjs';
import { figurePaths, figureWarmups } from '../../src/data/research/figures';

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
export type AuditWindow = Window & { drawAudit: DrawAudit };
export async function holdCompiler(page: Page) {
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
