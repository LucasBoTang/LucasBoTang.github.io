import { expect, test } from '@playwright/test';
import { figurePaths, researchFigures } from '../../src/data/research/figures';
import { waitForPicture } from '../helpers/visual-ready';

for (const width of [1280, 800, 375]) {
  for (const [name, route] of Object.entries(figurePaths)) {
    test(`${name} figure at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await waitForPicture(page);
      await expect(page).toHaveScreenshot(`${name}-${width}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
}

for (const [name, route] of Object.entries(figurePaths)) {
  test(`${name} home preview`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const preview = page.locator(`[data-figure-preview][data-preview-src="${route}"]`);
    await preview.hover();
    await expect(preview).toHaveAttribute('data-preview-visible', '');
    await expect(preview).not.toHaveAttribute('data-preview-pending', '');
    await waitForPicture(page);
    await expect(preview).toHaveScreenshot(`${name}-preview.png`, { animations: 'disabled' });
  });
}

for (const width of [1280, 375]) {
  for (const [kind, figure] of Object.entries(researchFigures)) {
    test(`${kind} static first frame at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route(`**${figure.src}`, (route) => route.abort());
      await page.goto('/research/');
      const artwork = page.locator(`#${figure.anchor} [data-scalable-figure]`);
      await artwork.scrollIntoViewIfNeeded();
      const poster = artwork.locator('[data-figure-poster]');
      await expect(poster).toBeVisible();
      await poster.locator('img').evaluate(async (image: HTMLImageElement) => {
        await image.decode();
      });
      await expect(artwork).toHaveScreenshot(`${kind}-poster-${width}.png`, {
        animations: 'disabled',
      });
    });
  }
}
