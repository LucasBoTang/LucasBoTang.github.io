import { expect, test } from '@playwright/test';

// Screenshots with reduced motion, compared with baselines in `pages.spec.ts-snapshots/`.
// Update them after an intended visual change: npm run test:visual:update.
const routes = [
  ['home', '/'],
  ['about', '/about/'],
  ['research', '/research/'],
  ['software', '/software/'],
] as const;

for (const width of [1280, 800, 375]) {
  for (const [name, route] of routes) {
    test(`${name} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${name}-${width}.png`, { animations: 'disabled' });
    });
  }

  test(`home About section at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.about')).toHaveScreenshot(`about-section-${width}.png`, {
      animations: 'disabled',
    });
  });
}
