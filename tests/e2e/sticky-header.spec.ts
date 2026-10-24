import { expect, test } from '@playwright/test';
import { primaryNavigation, routes } from '../../src/data/navigation';

test.use({ reducedMotion: 'reduce' });

for (const width of [1280, 430, 390, 375, 320]) {
  test(`the name and main navigation remain available while reading at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of Object.values(routes)) {
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
      ).toBeLessThanOrEqual(initialNavigation.y + initialNavigation.height);
      expect(
        await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link').count(),
      ).toBe(primaryNavigation.length);
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

for (const width of [320, 375, 390, 414, 430, 720]) {
  test(`the mobile header wraps only when its labels need more space at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto(routes.research);
    await page.evaluate(() => document.fonts.ready);
    const header = (await page.locator('.site-header').boundingBox())!;
    const name = (await page.locator('.site-header-name').boundingBox())!;
    const navigation = page.getByRole('navigation', { name: 'Main navigation' });
    const nav = (await navigation.boundingBox())!;
    // Font advances differ between platforms. Measure the groups' intrinsic space rather than
    // assigning a fixed wrap breakpoint; 390px is close enough to fit on only some platforms.
    const { required, available } = await navigation.evaluate((nav) => {
      const outerWidth = (element: Element) => {
        const style = getComputedStyle(element);
        return (
          element.getBoundingClientRect().width +
          parseFloat(style.marginLeft) +
          parseFloat(style.marginRight)
        );
      };
      const header = nav.parentElement!;
      const headerStyle = getComputedStyle(header);
      const links = Array.from(nav.querySelectorAll('a'));
      const navigationWidth =
        links.reduce((sum, link) => sum + outerWidth(link), 0) +
        parseFloat(getComputedStyle(nav).columnGap) * (links.length - 1);
      return {
        required:
          outerWidth(header.querySelector('.site-header-name')!) +
          parseFloat(headerStyle.columnGap) +
          navigationWidth,
        available:
          header.clientWidth -
          parseFloat(headerStyle.paddingLeft) -
          parseFloat(headerStyle.paddingRight),
      };
    });
    const oneRow = required <= available;
    if (width <= 380) {
      const links = await navigation.getByRole('link').all();
      const boxes = await Promise.all(links.map((link) => link.boundingBox()));
      expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(1);
      expect(Math.abs(boxes[2]!.y - boxes[3]!.y)).toBeLessThan(1);
      expect(boxes[2]!.y).toBeGreaterThan(boxes[0]!.y);
      expect(name.y).toBeLessThan(nav.y + nav.height);
      expect(nav.x).toBeGreaterThanOrEqual(name.x + name.width);
    }
    if (width >= 720) expect(oneRow).toBe(true);
    const sizing = `${required}px required, ${available}px available`;
    expect(Math.abs(name.x - header.x)).toBeLessThan(1);
    if (width <= 380) {
      expect(header.height).toBeLessThanOrEqual(80);
    } else if (oneRow) {
      expect(name.y, sizing).toBeLessThan(nav.y + nav.height);
      expect(nav.y, sizing).toBeLessThan(name.y + name.height);
      expect(Math.abs(nav.x + nav.width - header.x - header.width)).toBeLessThan(1);
    } else {
      expect(nav.y, sizing).toBeGreaterThanOrEqual(name.y + name.height);
      expect(Math.abs(nav.x - header.x)).toBeLessThan(1);
    }
    const links = navigation.getByRole('link');
    await expect(links.first()).toHaveCSS('font-size', '16px');
    const first = (await links.first().boundingBox())!;
    const last = (await links.last().boundingBox())!;
    expect(last.y).toBeGreaterThanOrEqual(first.y);
    expect(last.x + last.width).toBeLessThanOrEqual(header.x + header.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test('anchor clearance follows the actual header height after resizing between one and two rows', async ({
  page,
}) => {
  await page.goto(routes.research);
  await page.evaluate(() => document.fonts.ready);
  for (const width of [375, 430, 390, 320]) {
    await page.setViewportSize({ width, height: 812 });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const header = document.querySelector('.site-header')!;
          const wrap = header.parentElement!;
          const height = header.getBoundingClientRect().height;
          const reserved =
            parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) -
            parseFloat(getComputedStyle(wrap).paddingTop) -
            parseFloat(getComputedStyle(wrap, '::after').height);
          return Math.abs(height - reserved);
        }),
      )
      .toBeLessThan(0.5);
  }
});

test('Research chapter navigation keeps its destinations clear of the sticky header', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(routes.research);
  await page.locator('[data-reading-index] a[href="#learning-to-optimize"]').click();
  const header = (await page.locator('.site-header').boundingBox())!;
  const heading = (await page.locator('#learning-to-optimize h2').boundingBox())!;
  const index = (await page.locator('[data-reading-index]').boundingBox())!;
  expect(heading.y).toBeGreaterThanOrEqual(header.y + header.height + 32);
  expect(index.y).toBeGreaterThanOrEqual(header.y + header.height + 32);
});

test('links under the fading edge still receive clicks', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(routes.research);
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

for (const width of [1280, 375]) {
  test(`returning home keeps the header visible throughout its opening at ${width}px`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.documentElement.dataset.page !== 'home') return;
        const header = document.querySelector<HTMLElement>('.site-header')!;
        const start = performance.now();
        const sample = () => {
          const style = getComputedStyle(header);
          if (style.visibility !== 'visible' || Number(style.opacity) < 0.99)
            header.setAttribute('data-hidden-during-return', '');
          if (performance.now() - start < 2600) requestAnimationFrame(sample);
          else header.setAttribute('data-return-sampled', '');
        };
        sample();
      });
    });
    for (const route of Object.values(routes).filter((route) => route !== routes.home)) {
      await page.goto(route);
      await page.evaluate(() => scrollTo(0, 700));
      await page.locator('.site-header-name').click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('html')).toHaveAttribute('data-header-persistent', '');
      await expect(page.locator('.site-header')).toHaveAttribute('data-return-sampled', '');
      await expect(page.locator('.site-header')).not.toHaveAttribute(
        'data-hidden-during-return',
        '',
      );
    }
    // The return marker is consumed; an ordinary fresh load keeps the original home opening.
    await page.reload();
    await expect(page.locator('html')).not.toHaveAttribute('data-header-persistent', '');
  });
}
