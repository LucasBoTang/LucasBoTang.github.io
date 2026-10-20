import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

for (const width of [1280, 375, 320]) {
  test(`the name and main navigation remain available while reading at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/research/', '/software/', '/about/']) {
      await page.goto(route);
      const initialName = (await page.locator('.site-header-name').boundingBox())!;
      const initialNavigation = (await page
        .getByRole('navigation', { name: 'Main navigation' })
        .boundingBox())!;
      await page.evaluate(() => window.scrollTo(0, 700));
      const name = (await page.locator('.site-header-name').boundingBox())!;
      const navigation = (await page
        .getByRole('navigation', { name: 'Main navigation' })
        .boundingBox())!;
      expect(name.y, route).toBeGreaterThanOrEqual(0);
      expect(name.y, route).toBeCloseTo(initialName.y, 1);
      expect(navigation.y, route).toBeCloseTo(initialNavigation.y, 1);
      expect(navigation.y, route).toBeGreaterThanOrEqual(0);
      expect(
        Math.max(name.y + name.height, navigation.y + navigation.height),
        route,
      ).toBeLessThanOrEqual(width > 720 ? 64 : 80);
      expect(
        await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link').count(),
      ).toBe(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      for (const scrollTop of [24, 8, 0]) {
        await page.evaluate((top) => window.scrollTo(0, top), scrollTop);
        const current = (await page.locator('.site-header-name').boundingBox())!;
        expect(current.y, `${route} at scroll ${scrollTop}`).toBeCloseTo(initialName.y, 1);
      }
    }
  });
}

test('Research chapter navigation keeps its destinations clear of the sticky header', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/research/');
  await page.locator('[data-reading-index] a[href="#learning-to-optimize"]').click();
  const header = (await page.locator('.site-header').boundingBox())!;
  const heading = (await page.locator('#learning-to-optimize h2').boundingBox())!;
  const index = (await page.locator('[data-reading-index]').boundingBox())!;
  expect(heading.y).toBeGreaterThanOrEqual(header.y + header.height + 32);
  expect(index.y).toBeGreaterThanOrEqual(header.y + header.height + 32);
});

test('links under the fading edge still receive clicks', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/research/');
  const link = page.locator('.publication .resource-links a').first();
  await link.evaluate((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      element.setAttribute('data-clicked', '');
    });
    window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 72);
  });
  const box = (await link.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(link).toHaveAttribute('data-clicked', '');
});
