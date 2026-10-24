import { expect, type Page, type TestInfo } from '@playwright/test';
import { figurePaths } from '../../src/data/research/figures';
import { holdCompiler, type AuditWindow } from './figure-drawing';
import { trackVisit, visitReport } from './visit-metrics';

export async function expectPreviewDuringWarmup(page: Page, info?: TestInfo) {
  const measure = Boolean(info);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (measure) await trackVisit(page, 4);
  await holdCompiler(page);
  const preview = page.locator(`[data-figure-preview][data-preview-src="${figurePaths.l2o}"]`);
  const interactionStartEpochMs = await page.evaluate(
    () => performance.timeOrigin + performance.now(),
  );
  const started = performance.now();
  await preview.hover();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as AuditWindow).drawAudit.previewStartedDuringWarmup),
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
  if (measure && info) {
    const report = await visitReport(page, info, {
      scenario: 'preview during stalled warm-up',
      cpuRate: 4,
      previewReadyMs,
      interactionStartEpochMs,
      blankAfterHandoverMs,
    });
    expect(report.maxInteractionTask, 'preview interaction long-task budget').toBeLessThan(200);
  }
  expect(blankAfterHandoverMs, 'handover must wait for the first drawing').toBe(0);
  expect(errors).toEqual([]);
}
