import { expect, test } from '@playwright/test';
import { routes as siteRoutes } from '../../src/data/navigation';
import { missingPageRoute } from '../test-routes';
import { watchErrors } from './helpers';

// What every page must do, whatever its motion: load cleanly, fit narrow screens, read whole
// without motion, and show keyboard focus.

const routes = Object.values(siteRoutes);
const viewports = [
  { width: 1280, reducedMotion: 'no-preference' },
  { width: 800, reducedMotion: 'reduce' },
  { width: 375, reducedMotion: 'no-preference' },
] as const;

for (const route of [...routes, missingPageRoute]) {
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
  await page.goto(siteRoutes.research);
  for (const unit of await page.locator('[data-reveal]').all())
    await expect(unit).toHaveCSS('opacity', '1');
  await page.goto(siteRoutes.home);
  await expect(page.locator('[data-home-motion]')).not.toHaveAttribute('data-motion-ready', /.*/);
  await expect(page.locator('.portrait')).toHaveCSS('opacity', '1');
  await expect(page.locator('.work-entry').first()).toHaveCSS('opacity', '1');
});

test('keyboard focus is visible', async ({ page }) => {
  await page.goto(siteRoutes.about);
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
  await page.goto(siteRoutes.research);
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
  await page
    .locator('#h-pdlp')
    .getByRole('button', { name: /^BibTeX:/ })
    .click();
  await expect(bib.getByRole('button', { name: 'Copy BibTeX', exact: true })).toBeVisible();
  await expect(bib.locator('[data-bibtex-status]')).toHaveText('');
});

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("a paper's links and its Bib share one line, each with room for a fingertip", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(siteRoutes.research);
    const items = page.locator('#h-pdlp .resource-links > li > :is(a, button)');
    const boxes = await items.evaluateAll((elements) =>
      elements.map((element) => {
        const label = element.querySelector('.link-label')!.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        return { label: label.top, height: box.height, reach: box.width - label.width };
      }),
    );
    expect(boxes.length).toBeGreaterThan(1);
    for (const box of boxes) {
      expect(Math.abs(box.label - boxes[0].label)).toBeLessThan(1);
      expect(box.height).toBeGreaterThanOrEqual(28);
      // A step of room on either side of the word.
      expect(box.reach).toBeGreaterThanOrEqual(16);
    }
  });
});
