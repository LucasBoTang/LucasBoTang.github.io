import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

// What every page must do, whatever its motion: load cleanly, fit narrow screens, read whole
// without motion, and show keyboard focus.

const routes = ['/', '/about/', '/research/', '/software/'];
const viewports = [
  { width: 1280, reducedMotion: 'no-preference' },
  { width: 800, reducedMotion: 'reduce' },
  { width: 375, reducedMotion: 'no-preference' },
] as const;

for (const route of [...routes, '/missing-page/']) {
  for (const { width, reducedMotion } of viewports) {
    test(`${route} loads cleanly at ${width}px with ${reducedMotion} motion`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.emulateMedia({ reducedMotion });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', /.*/, {
        timeout: 3000,
      });
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('.site-header')).toBeVisible();
      // Let openings and their scripts run, so late errors are caught too.
      await page.waitForTimeout(1500);
      expect(errors).toEqual([]);
    });
  }
}

test('no page scrolls sideways at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of routes) {
    await page.goto(route);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, route).toBeLessThanOrEqual(0);
  }
});

test('with reduced motion, every page shows whole at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/research/');
  for (const unit of await page.locator('[data-reveal]').all())
    await expect(unit).toHaveCSS('opacity', '1');
  await page.goto('/');
  await expect(page.locator('[data-home-motion]')).not.toHaveAttribute('data-motion-ready', /.*/);
  await expect(page.locator('.portrait')).toHaveCSS('opacity', '1');
  await expect(page.locator('.work-entry').first()).toHaveCSS('opacity', '1');
});

test('keyboard focus is visible', async ({ page }) => {
  await page.goto('/about/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe('none');
});

test("a paper's Bib opens its BibTeX in a dialog, which copies whole", async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Without motion, the entry is in place at once, not still arriving under the pointer.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/research/');
  const bib = page.locator('#h-pdlp-bibtex');
  await expect(bib).toBeHidden();
  await page
    .locator('#h-pdlp')
    .getByRole('button', { name: /^BibTeX:/ })
    .click();
  await expect(bib).toBeVisible();
  await bib.getByRole('button', { name: 'Copy' }).click();
  await expect(bib.getByRole('button', { name: 'Copied' })).toBeVisible();
  // The system clipboard may end its lines its own way.
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.replace(/\r\n/g, '\n')).toBe(await bib.locator('code').textContent());
  await page.keyboard.press('Escape');
  await expect(bib).toBeHidden();
});
