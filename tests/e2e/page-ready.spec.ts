import { expect, test } from '@playwright/test';
import { routes } from '../../src/data/navigation';

for (const [from, route, title] of [
  ['Research', routes.software, 'Software'],
  ['', routes.research, 'Research'],
]) {
  test(`the ${title} hand-over starts before body resources settle and stays visible`, async ({
    page,
  }) => {
    let releaseFont!: () => void;
    const fontReady = new Promise<void>((resolve) => (releaseFont = resolve));
    // Hold only the body font; the title's own serif can load and draw normally.
    await page.route(/geist-latin-wght-normal.*\.woff2/, async (request) => {
      await fontReady;
      await request.continue();
    });
    await page.addInitScript((previousTitle) => {
      sessionStorage.setItem(
        'page-title-from',
        JSON.stringify({ to: location.href, title: previousTitle, at: Date.now() }),
      );
    }, from);
    try {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const heading = page.locator('h1');
      await expect(heading.locator('.title-decode-glyph').first()).toBeAttached({ timeout: 400 });
      await expect(page.locator('[data-page-intro] [data-typed-text]')).toHaveAttribute(
        'data-typing-started',
        '',
        { timeout: 300 },
      );
      await expect(page.locator('html')).toHaveAttribute('data-opening-pending', '');
      await expect(heading).not.toHaveAttribute('data-title-from', /.*/, { timeout: 1400 });
      await expect(heading).toHaveText(title);
      await expect(page.locator('html')).toHaveAttribute('data-opening-pending', '');
      await expect(heading).toBeVisible();
      await heading.evaluate((element) => {
        element.setAttribute('data-test-extra-slip', 'false');
        new MutationObserver(() => {
          if (element.querySelector('[data-slip]'))
            element.setAttribute('data-test-extra-slip', 'true');
        }).observe(element, { subtree: true, attributes: true, attributeFilter: ['data-slip'] });
      });
    } finally {
      releaseFont();
    }
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '');
    // Resource loading and the reading pause overlap; a late font must not start a second wait.
    await expect
      .poll(
        () =>
          page
            .locator('[data-reveal="unit"]')
            .first()
            .evaluate((unit) => Number(getComputedStyle(unit).opacity)),
        { timeout: 1000 },
      )
      .toBeGreaterThan(0.05);
    // A completed hand-over must not be mistaken for a fresh title and wiped in a second time.
    expect(await page.locator('h1').evaluate((heading) => heading.getAnimations().length)).toBe(0);
    await page.waitForTimeout(1300);
    await expect(page.locator('h1')).toHaveAttribute('data-test-extra-slip', 'false');
  });
}

for (const route of Object.values(routes)) {
  test(`${route} leaves a quiet interval after fonts load before showing its opening`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          void document.fonts.ready.then(() => performance.mark('test:fonts-ready'));
        },
        { once: true },
      );
      const observer = new MutationObserver(() => {
        if (document.documentElement.hasAttribute('data-opening-pending')) return;
        performance.mark('test:opening-visible');
        observer.disconnect();
      });
      observer.observe(document, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-opening-pending'],
      });
    });
    await page.goto(route);
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '');
    const quietInterval = await page.evaluate(
      () =>
        performance.getEntriesByName('test:opening-visible')[0].startTime -
        performance.getEntriesByName('test:fonts-ready')[0].startTime,
    );
    expect(quietInterval).toBeGreaterThanOrEqual(350);
  });
}

for (const route of [routes.home, routes.research]) {
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
      if (route === routes.home)
        await expect(page.locator('[data-home-motion]')).not.toHaveAttribute(
          'data-opening-started',
        );
    } finally {
      releaseFonts();
    }
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '', {
      timeout: 4000,
    });
    if (route === routes.home)
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
    await page.goto(routes.home, { waitUntil: 'domcontentloaded' });
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
    await page.goto(routes.research, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-opening-pending', '');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '', {
      timeout: 500,
    });
  } finally {
    releaseFonts();
  }
});
