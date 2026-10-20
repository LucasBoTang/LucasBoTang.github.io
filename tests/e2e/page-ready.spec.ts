import { expect, test } from '@playwright/test';

for (const route of ['/', '/research/']) {
  test(`${route} waits for first-screen fonts before starting its opening`, async ({ page }) => {
    let releaseFonts!: () => void;
    const fontsReady = new Promise<void>((resolve) => (releaseFonts = resolve));
    await page.route('**/*.woff2', async (request) => {
      await fontsReady;
      await request.continue();
    });
    try {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);
      await expect(page.locator('html')).toHaveAttribute('data-opening-pending', '');
      if (route === '/')
        await expect(page.locator('[data-home-motion]')).not.toHaveAttribute(
          'data-opening-started',
        );
    } finally {
      releaseFonts();
    }
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '', {
      timeout: 4000,
    });
    if (route === '/')
      await expect(page.locator('[data-home-motion]')).toHaveAttribute(
        'data-opening-started',
        /.+/,
      );
    await expect(page.locator('h1')).toBeVisible();
  });
}

test('a stalled font cannot keep the page hidden or start a late home opening', async ({
  page,
}) => {
  let releaseFonts!: () => void;
  const held = new Promise<void>((resolve) => (releaseFonts = resolve));
  await page.route('**/*.woff2', async (request) => {
    await held;
    await request.continue();
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '', {
      timeout: 3000,
    });
    await expect(page.locator('[data-home-motion]')).not.toHaveAttribute('data-opening-started');
    await expect(page.locator('.portrait')).toHaveCSS('opacity', '1');
  } finally {
    releaseFonts();
  }
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-home-motion]')).not.toHaveAttribute('data-opening-started');
});

test('reduced motion releases a page even while its fonts are still loading', async ({ page }) => {
  let releaseFonts!: () => void;
  const held = new Promise<void>((resolve) => (releaseFonts = resolve));
  await page.route('**/*.woff2', async (request) => {
    await held;
    await request.continue();
  });
  try {
    await page.goto('/research/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-opening-pending', '');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '', {
      timeout: 500,
    });
  } finally {
    releaseFonts();
  }
});
