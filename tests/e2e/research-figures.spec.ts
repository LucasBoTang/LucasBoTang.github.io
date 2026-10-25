import { expect, test, type Page } from '@playwright/test';
import { routes } from '../../src/data/navigation';
import { researchFigures } from '../../src/data/research/figures';
import { ARRIVAL_EVENT } from '../../src/lib/arrival';
import { watchErrors } from './helpers';

/** Keep the real figure request pending until a test has checked the waiting or skip state. */
async function holdFigureDocument(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**${researchFigures.gpu.src}`, async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

for (const width of [1280, 375]) {
  test(`Research figures join their motion while still appearing at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      new MutationObserver((records) => {
        for (const { target } of records) {
          const screen = target as HTMLElement;
          if (screen.hasAttribute('data-screen-pending')) continue;
          const picture = screen.querySelector('.screen-picture');
          if (picture) screen.dataset.testPlaybackOpacity = getComputedStyle(picture).opacity;
        }
      }).observe(document, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-screen-pending'],
      });
    });
    await page.goto(routes.research);
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending');
    for (const { anchor } of Object.values(researchFigures)) {
      const figure = page.locator(`#${anchor}`);
      const screen = figure.locator('[data-screen-reveal]');
      await screen.scrollIntoViewIfNeeded();
      await expect(screen).toHaveAttribute('data-test-playback-opacity', /.+/);
      const opacity = Number(await screen.getAttribute('data-test-playback-opacity'));
      expect(opacity).toBeGreaterThan(0.1);
      expect(opacity).toBeLessThan(0.98);
      await expect(screen.locator('.screen-picture')).toHaveCSS('opacity', '1');
      await expect(screen.locator('.screen-picture')).toHaveCSS('filter', 'none');
      await expect(screen.locator('.screen-picture')).toHaveCSS('transform', 'none');
    }
    expect(errors).toEqual([]);
  });
}

test('a late Research document enters with its static first frame, then hands over when drawn', async ({
  page,
}) => {
  await page.addInitScript((arrivalEvent) => {
    document.addEventListener(
      arrivalEvent,
      (event) => {
        const trigger = event.target as HTMLElement;
        if (trigger.matches('.screen-trigger'))
          trigger.dataset.testArrivalAt = String(
            performance.now() + (event as CustomEvent).detail.delay,
          );
      },
      true,
    );
  }, ARRIVAL_EVENT);
  const release = await holdFigureDocument(page);
  try {
    await page.goto(routes.research, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending');
    const screen = page.locator(`#${researchFigures.gpu.anchor} [data-screen-reveal]`);
    await screen.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        screen.locator('.screen-trigger').evaluate((trigger) => {
          const at = Number((trigger as HTMLElement).dataset.testArrivalAt);
          return at > 0 && performance.now() >= at + 750;
        }),
      )
      .toBe(true);
    await expect(screen.locator('.screen-picture')).toHaveCSS('opacity', '1');
    await expect(screen.locator('[data-figure-poster] img')).toBeVisible();
    await expect(screen.locator('[data-scalable-figure]')).not.toHaveAttribute(
      'data-figure-live',
      '',
    );
    release();
    await expect(screen.locator('[data-scalable-figure]')).toHaveAttribute('data-figure-live', '');
    await expect(screen.locator('.screen-picture')).toHaveCSS('opacity', '1');
    await expect(screen).not.toHaveAttribute('data-screen-pending');
  } finally {
    release();
  }
});

test('keyboard skip is not undone when a late Research figure finishes loading', async ({
  page,
}) => {
  const release = await holdFigureDocument(page);
  try {
    await page.goto(routes.research, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending');
    const screen = page.locator(`#${researchFigures.gpu.anchor} [data-screen-reveal]`);
    await screen.scrollIntoViewIfNeeded();
    await page.keyboard.press('Tab');
    await expect(screen.locator('.screen-picture')).toHaveCSS('opacity', '1');
    release();
    await expect
      .poll(() =>
        screen
          .locator('iframe')
          .evaluate(
            (frame) =>
              (frame as HTMLIFrameElement).contentDocument?.readyState === 'complete' &&
              (frame as HTMLIFrameElement).contentDocument?.URL !== 'about:blank',
          ),
      )
      .toBe(true);
    const minimum = await screen.locator('.screen-picture').evaluate(
      (picture) =>
        new Promise<number>((resolve) => {
          const start = performance.now();
          let minimum = 1;
          const sample = () => {
            minimum = Math.min(minimum, Number(getComputedStyle(picture).opacity));
            if (performance.now() - start < 600) requestAnimationFrame(sample);
            else resolve(minimum);
          };
          sample();
        }),
    );
    expect(minimum, 'a skipped entrance must never restart and hide the picture').toBe(1);
  } finally {
    release();
  }
});

test('reduced motion shows Research figures without preparing an entrance', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(routes.research);
  for (const { anchor } of Object.values(researchFigures)) {
    const screen = page.locator(`#${anchor} [data-screen-reveal]`);
    await screen.scrollIntoViewIfNeeded();
    await expect(screen.locator('.screen-picture')).toHaveCSS('opacity', '1');
    await expect(screen).not.toHaveAttribute('data-screen-pending');
  }
});
