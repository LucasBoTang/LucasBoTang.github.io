import { expect, test } from '@playwright/test';

for (const width of [1280, 375]) {
  test(`a navigation click connects in blue once, while hover keeps its colour at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/research/');
    const navigation = page.getByRole('navigation', { name: 'Main navigation' });
    const software = navigation.getByRole('link', { name: 'Software', exact: true });
    await software.hover();
    await expect(software).toHaveCSS('color', 'rgb(163, 167, 173)');
    await expect(navigation.locator('[data-nav-connect]')).toHaveCount(0);
    // Keep this document for the animation's complete cycle. Preventing at window happens
    // after navigation's click feedback, as a cancelled navigation would.
    await navigation.evaluate((element) => {
      window.addEventListener('click', (event) => event.preventDefault(), { once: true });
      element.addEventListener('animationstart', (event) => {
        if (!(event instanceof AnimationEvent) || event.animationName !== 'signal-nav-connect')
          return;
        const choice = event.target as HTMLElement;
        element.setAttribute('data-test-pulse', choice.closest('a')!.getAttribute('href')!);
        element.setAttribute('data-test-sweep', getComputedStyle(choice).backgroundClip);
      });
    });
    await software.click();
    await expect(navigation).toHaveAttribute('data-test-pulse', '/software/');
    await expect(navigation).toHaveAttribute('data-test-sweep', 'text');
    await expect
      .poll(() =>
        software.evaluate((link) =>
          link
            .getAnimations({ subtree: true })
            .some(
              (animation) =>
                animation instanceof CSSAnimation &&
                animation.animationName === 'signal-nav-connect' &&
                animation.playState === 'finished',
            ),
        ),
      )
      .toBe(true);
    await expect(software).toHaveCSS('color', 'rgb(110, 141, 184)');
    await expect(software.locator('.roll-face').first()).toHaveCSS('transform', 'none');
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
    );
    await expect(navigation.locator('[data-nav-connect]')).toHaveCount(0);
    await expect(software).toHaveCSS('color', 'rgb(163, 167, 173)');
    await expect(navigation.getByRole('link', { name: 'Research', exact: true })).toHaveCSS(
      'color',
      'rgb(110, 141, 184)',
    );
  });
}

test('activation feedback keeps normal navigation and the destination current-page colour', async ({
  page,
}) => {
  await page.goto('/research/');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Software', exact: true })
    .click();
  await expect(page).toHaveURL(/\/software\/$/);
  await expect(page.locator('.site-header nav a[aria-current="page"]')).toHaveAccessibleName(
    'Software',
  );
  await expect(page.locator('.site-header nav a[aria-current="page"]')).toHaveCSS(
    'color',
    'rgb(110, 141, 184)',
  );
  const current = page.locator('.site-header nav a[aria-current="page"]');
  await expect(page.locator('.site-header')).toHaveAttribute('data-hover-ready', '');
  await current.hover();
  await expect(current.locator('.roll-face').first()).toHaveCSS('transform', 'none');
  expect(await current.evaluate((link) => link.getAnimations({ subtree: true }).length)).toBe(0);
  await page.mouse.move(0, 0);
  await current.hover();
  await expect(current.locator('.roll-face').first()).not.toHaveCSS('transform', 'none');
  await expect(current).toHaveCSS('color', 'rgb(110, 141, 184)');
});

test('hover waits for fonts and page readiness before rolling an inactive link', async ({
  page,
}) => {
  let releaseFonts!: () => void;
  const fonts = new Promise<void>((resolve) => {
    releaseFonts = resolve;
  });
  await page.route('**/*.woff2', async (route) => {
    await fonts;
    await route.continue();
  });
  try {
    await page.goto('/research/', { waitUntil: 'domcontentloaded' });
    const header = page.locator('.site-header');
    const software = header.getByRole('link', { name: 'Software', exact: true });
    await software.hover();
    await expect(header).not.toHaveAttribute('data-hover-ready', '');
    await expect(software.locator('.roll-face').first()).toHaveCSS('transform', 'none');
    releaseFonts();
    await expect(header).toHaveAttribute('data-hover-ready', '');
    await expect(software.locator('.roll-face').first()).not.toHaveCSS('transform', 'none');
    await expect(software).toHaveCSS('color', 'rgb(163, 167, 173)');
  } finally {
    releaseFonts();
  }
});

test('keyboard focus rolls the current page even when its initial hover is held', async ({
  page,
}) => {
  await page.goto('/research/');
  const header = page.locator('.site-header');
  const current = header.locator('nav a[aria-current="page"]');
  await expect(header).toHaveAttribute('data-hover-ready', '');
  await expect(current).toHaveAttribute('data-hover-hold', '');
  await page.keyboard.press('Tab');
  await current.focus();
  await expect(current.locator('.roll-face').first()).toHaveCSS('transition-duration', '0.48s');
  await expect(current.locator('.roll-face').first()).not.toHaveCSS('transform', 'none');
  await expect(current).toHaveCSS('color', 'rgb(110, 141, 184)');
});

test('home hover waits until its header entrance has finished', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-motion]')).toHaveAttribute('data-opening-started', /.+/);
  const header = page.locator('.site-header');
  const research = header.getByRole('link', { name: 'Research', exact: true });
  await research.hover();
  await expect(header).not.toHaveAttribute('data-hover-ready', '');
  await expect(research.locator('.roll-face').first()).toHaveCSS('transform', 'none');
  await expect(header).toHaveAttribute('data-hover-ready', '');
  expect(
    await header.evaluate((element) =>
      element.getAnimations().every((animation) => animation.playState === 'finished'),
    ),
  ).toBe(true);
  await expect(research.locator('.roll-face').first()).not.toHaveCSS('transform', 'none');
});

test('reduced motion changes page without the activation impulse', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/research/');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await navigation.evaluate(() => {
    window.addEventListener('click', (event) => event.preventDefault(), { once: true });
  });
  await navigation.getByRole('link', { name: 'Software', exact: true }).click();
  await expect(navigation.locator('[data-nav-connect]')).toHaveCount(0);
});
