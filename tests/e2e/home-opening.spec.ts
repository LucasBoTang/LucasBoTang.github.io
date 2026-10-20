import { expect, test } from '@playwright/test';
import { openingTiming as time } from '../../src/components/home/opening/opening';
import { attributeChanges, openingStartedAt, recordAttribute } from './helpers';

// The home opening: the portrait develops and glitches into the photograph and the name decodes;
// then the research lanes open as the introduction starts typing, and the reading units follow.

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('the portrait develops, then the photograph takes over with nothing left on the canvas', async ({
  page,
}) => {
  await page.goto('/');
  const hero = page.locator('[data-home-motion]');
  await expect(hero).toHaveAttribute('data-opening-started', /.+/);
  await expect(hero).toHaveAttribute('data-motion-ready', '');
  await expect(hero).not.toHaveAttribute('data-opening', /.*/, { timeout: 6000 });
  await expect(page.locator('.portrait')).toHaveCSS('opacity', '1');
  await expect
    .poll(() =>
      page.locator('[data-portrait-develop]').evaluate((canvas: HTMLCanvasElement) => {
        const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
        return pixels.data.some((value, i) => i % 4 === 3 && value > 0);
      }),
    )
    .toBe(false);
});

test('the name decodes over its own text, then hands over to it', async ({ page }) => {
  await page.goto('/');
  const decode = page.locator('h1 .name-scramble');
  await expect(decode).toBeAttached({ timeout: 4000 });
  await expect(decode).not.toBeAttached({ timeout: 6000 });
  await expect(page.locator('h1 .name-base')).toHaveCSS('opacity', '1');
  await expect(page.locator('h1')).toHaveAccessibleName('Bo Tang');
});

test('the introduction types its sentence in full', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-motion]')).toHaveAttribute('data-typing-ready', '');
  await expect(page.locator('.intro-letter[data-unseen]')).toHaveCount(0, { timeout: 12000 });
  const typed = await page.locator('[data-intro-typed]').textContent();
  const sentence = await page.locator('.intro-copy').textContent();
  expect(typed?.trim()).toBe(sentence?.trim());
});

test('the introduction waits for the research lanes to open', async ({ page }) => {
  await recordAttribute(page, 'data-intro-waiting');
  await page.goto('/');
  await expect(page.locator('[data-home-motion]')).toHaveAttribute('data-opening-started', /.+/);
  await expect(page.locator('[data-home-motion]')).not.toHaveAttribute('data-intro-waiting', /.*/, {
    timeout: 6000,
  });
  const released = (await attributeChanges(page, 'data-intro-waiting')).find(({ on }) => !on)!;
  expect(released.at - (await openingStartedAt(page))).toBeGreaterThanOrEqual(time.laneDelay);
});

test('the research lanes drift once connected', async ({ page }) => {
  await page.goto('/');
  await expect
    .poll(() =>
      page
        .locator('.lane-track')
        .first()
        .evaluate((track) => getComputedStyle(track).animationName),
    )
    .toBe('lane-drift');
});

test('the reading units arrive after the research lanes open', async ({ page }) => {
  // Regression: a lost reading cue once left everything below the hero transparent.
  await page.goto('/');
  for (const selector of ['.work-entry', '.work-navigation', '.about', '.site-footer']) {
    const unit = page.locator(selector).first();
    await unit.scrollIntoViewIfNeeded();
    await expect(unit, selector).toHaveCSS('opacity', '1', { timeout: 10000 });
  }
});
