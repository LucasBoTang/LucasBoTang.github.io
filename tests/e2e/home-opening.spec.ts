import { expect, test } from '@playwright/test';
import { openingTiming } from '../../src/components/home/opening/opening';
import { routes } from '../../src/data/navigation';
import { arrival } from '../../src/lib/arrival';
import { attributeChanges, openingStartedAt, recordAttribute, watchErrors } from './helpers';

// The home opening: the portrait develops and glitches into the photograph and the name decodes;
// lanes follow the affiliation; reading below waits for the hero to settle.

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

for (const width of [1280, 375]) {
  for (const route of Object.values(routes).filter((route) => route !== routes.home)) {
    test(`returning from ${route} fades home prose without typing at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const errors = watchErrors(page);
      await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          if (document.documentElement.dataset.page !== 'home') return;
          const passages = [...document.querySelectorAll('.hero-intro, .hero-bio')];
          const bio = document.querySelector('.hero-bio')!;
          const field = document.querySelector('.research-topic .lane-field')!;
          const sample = () => {
            const intro = passages[0].getAnimations()[0];
            const lane = field.getAnimations()[0];
            if (
              !bio.hasAttribute('data-test-return-lane-delay') &&
              typeof intro?.startTime === 'number' &&
              typeof lane?.startTime === 'number'
            )
              bio.setAttribute(
                'data-test-return-lane-delay',
                String(lane.startTime - intro.startTime - Number(intro.effect!.getTiming().delay)),
              );
            let settled = 0;
            for (const passage of passages) {
              const style = getComputedStyle(passage);
              if (style.visibility !== 'visible') continue;
              const opacity = Number(style.opacity);
              if (opacity > 0 && opacity < 0.99) passage.setAttribute('data-test-return-fade', '');
              if (opacity >= 0.99) settled++;
            }
            if (settled < passages.length) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
      });
      await page.goto(route);
      await recordAttribute(page, 'data-typing-started');
      await page.locator('.site-header-name').click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('html')).toHaveAttribute('data-header-persistent', '');
      await expect(page.locator('[data-home-motion]')).toHaveAttribute(
        'data-opening-started',
        /.+/,
      );
      for (const paragraph of ['.hero-intro', '.hero-bio']) {
        const passage = page.locator(paragraph);
        await expect(passage.locator('[data-typed-text]')).toHaveAttribute(
          'data-typing-complete',
          '',
        );
        await expect(passage).toHaveAttribute('data-test-return-fade', '');
        await expect(passage).toHaveCSS('opacity', '1');
      }
      expect(await attributeChanges(page, 'data-typing-started')).toEqual([]);
      if (width === 1280) {
        const gap = Number(
          await page.locator('.hero-bio').getAttribute('data-test-return-lane-delay'),
        );
        expect(Math.abs(gap - openingTiming.returnLaneDelay)).toBeLessThan(80);
      }
      await page.locator('.research-navigator').scrollIntoViewIfNeeded();
      await expect(page.locator('.research-topic[data-connecting]')).toHaveCount(0);
      await expect(page.locator('.hero-actions')).toHaveCSS('opacity', '1');
      await expect(page.locator('.hero-bio .intro-cursor')).toHaveCSS('visibility', 'visible');
      expect(errors).toEqual([]);
    });
  }
}

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

test('the greeting leads, then affiliation, portrait and bio arrive together', async ({ page }) => {
  await recordAttribute(page, 'data-typing-started');
  await recordAttribute(page, 'data-greeting-complete');
  await page.goto('/');
  await expect(page.locator('.hero-bio [data-typed-text]')).toHaveAttribute(
    'data-typing-started',
    '',
  );
  const openingAt = await openingStartedAt(page);
  const greetingAt = (await attributeChanges(page, 'data-typing-started')).find(({ on }) => on)!.at;
  const bioAt = (await attributeChanges(page, 'data-typing-started'))
    .filter(({ on }) => on)
    .at(-1)!.at;
  const greetedAt = (await attributeChanges(page, 'data-greeting-complete')).find(
    ({ on }) => on,
  )!.at;
  const affiliationAt = await page.locator('.affiliation').evaluate((element) => {
    const entrance = element.getAnimations()[0];
    return Number(entrance.startTime) + Number(entrance.effect!.getTiming().delay);
  });
  expect(openingAt - greetingAt).toBeGreaterThan(300);
  expect(Math.abs(openingAt - greetedAt)).toBeLessThan(30);
  expect(Math.abs(affiliationAt - openingAt - openingTiming.formStart)).toBeLessThan(80);
  expect(Math.abs(bioAt - affiliationAt)).toBeLessThan(100);
});

test('the home bio keeps typing at a readable pace after the portrait settles', async ({
  page,
}) => {
  await recordAttribute(page, 'data-typing-complete');
  await page.goto('/');
  await expect(page.locator('.hero-intro [data-typed-text]')).toHaveAttribute(
    'data-typing-ready',
    '',
  );
  await expect(page.locator('.intro-letter[data-unseen]')).toHaveCount(0, { timeout: 16000 });
  for (const host of await page.locator('[data-home-motion] [data-typed-text]').all()) {
    expect((await host.locator('[data-intro-typed]').textContent())?.trim()).toBe(
      (await host.locator('.intro-copy').textContent())?.trim(),
    );
  }
  await expect(page.locator('.hero-bio [data-typed-text]')).toHaveAttribute(
    'data-typing-complete',
    '',
  );
  const completed = (await attributeChanges(page, 'data-typing-complete')).filter(({ on }) => on);
  expect(completed).toHaveLength(2);
  const openingAt = await openingStartedAt(page);
  expect(completed[1].at - openingAt).toBeGreaterThan(3000);
  expect(completed[1].at - openingAt).toBeLessThan(7000);
});

test('the phone portrait opens without waiting for its off-screen greeting', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 640 });
  await page.goto('/');
  const greeting = page.locator('.hero-intro');
  const hello = greeting.locator('[data-typed-text]');
  await expect(page.locator('[data-home-motion]')).toHaveAttribute('data-opening-started', /.+/);
  const greetingBox = (await greeting.boundingBox())!;
  const portraitBox = (await page.locator('.portrait-block').boundingBox())!;
  const affiliationBox = (await page.locator('.affiliation').boundingBox())!;
  expect(portraitBox.y).toBeLessThan(640);
  expect(greetingBox.y).toBeGreaterThan(640);
  expect(greetingBox.y).toBeGreaterThan(affiliationBox.y + affiliationBox.height);
  await expect(hello).not.toHaveAttribute('data-typing-started', '');
  await expect(page.locator('[data-home-motion]')).not.toHaveAttribute('data-opening', /.*/);
  await expect(hello).not.toHaveAttribute('data-typing-started', '');
});

test('narrowing to a phone during the greeting releases the portrait', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('[data-home-motion]');
  const greeting = page.locator('.hero-intro [data-typed-text]');
  await expect(greeting).toHaveAttribute('data-typing-started', '');
  await page.setViewportSize({ width: 375, height: 640 });
  await expect(hero).toHaveAttribute('data-opening-started', /.+/, { timeout: 800 });
  await expect(greeting).not.toHaveAttribute('data-typing-complete', '');
  await expect(hero).not.toHaveAttribute('data-opening', /.*/);
});

test('site-link returns still fade prose without view-transition support', async ({ page }) => {
  await page.addInitScript(() => {
    let owner: object | null = window;
    while (owner) {
      Reflect.deleteProperty(owner, 'onpageswap');
      owner = Object.getPrototypeOf(owner);
    }
    window.addEventListener('pageswap', (event) => event.stopImmediatePropagation(), {
      capture: true,
    });
  });
  await page.goto(routes.research);
  expect(await page.evaluate(() => 'onpageswap' in window)).toBe(false);
  await page.locator('.site-header-name').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-header-persistent', '');
  await expect(page.locator('[data-home-motion] [data-typing-started]')).toHaveCount(0);
  await expect(page.locator('[data-home-motion] [data-typing-complete]')).toHaveCount(2);
  await expect(page.locator('.hero-bio')).toHaveCSS('opacity', '1');
});

test('lanes follow the affiliation while typing and reading waits for the finished hero', async ({
  page,
}) => {
  await recordAttribute(page, 'data-typing-complete');
  await page.goto('/');
  const bio = page.locator('.hero-bio [data-typed-text]');
  const reading = await page.evaluate(
    () =>
      new Promise<{
        at: number;
        fieldAt: number;
        affiliationAt: number;
        lightEnd: number;
        textComplete: boolean;
        typingAtOpening: boolean;
      }>((resolve) => {
        const heading = document.querySelector('#work-heading')!;
        const affiliation = document.querySelector('.affiliation')!;
        const field = document.querySelector('.research-topic .lane-field')!;
        const light = document.querySelector('.research-topic:last-child .lane-light-window')!;
        const text = document.querySelector('.hero-bio [data-typed-text]')!;
        let lightEnd: number | undefined;
        let fieldAt: number | undefined;
        let affiliationAt: number | undefined;
        let typingAtOpening = false;
        const sample = () => {
          const identity = affiliation.getAnimations()[0];
          if (typeof identity?.startTime === 'number')
            affiliationAt = identity.startTime + Number(identity.effect!.getTiming().delay);
          const fieldOpening = field.getAnimations()[0];
          if (fieldAt === undefined && typeof fieldOpening?.startTime === 'number') {
            fieldAt = fieldOpening.startTime;
            typingAtOpening =
              text.hasAttribute('data-typing-started') &&
              !text.hasAttribute('data-typing-complete');
          }
          const illumination = light.getAnimations()[0];
          if (typeof illumination?.startTime === 'number')
            lightEnd =
              illumination.startTime + Number(illumination.effect!.getComputedTiming().endTime);
          const entrance = heading.getAnimations()[0];
          if (
            typeof entrance?.startTime === 'number' &&
            lightEnd !== undefined &&
            fieldAt !== undefined &&
            affiliationAt !== undefined
          )
            resolve({
              at: entrance.startTime,
              fieldAt,
              affiliationAt,
              lightEnd,
              textComplete: text.hasAttribute('data-typing-complete'),
              typingAtOpening,
            });
          else requestAnimationFrame(sample);
        };
        sample();
      }),
  );
  expect(reading.textComplete).toBe(true);
  expect(reading.typingAtOpening).toBe(true);
  expect(Math.abs(reading.fieldAt - reading.affiliationAt - arrival.beat)).toBeLessThan(80);
  // Timers can run just before the animation's next display frame.
  expect(reading.at - reading.lightEnd).toBeGreaterThan(-50);
  await expect(bio).toHaveAttribute('data-typing-complete', '', { timeout: 14000 });
  await expect(page.locator('.research-topic[data-connecting]')).toHaveCount(0);
  const completed = (await attributeChanges(page, 'data-typing-complete'))
    .filter(({ on }) => on)
    .at(-1)!;
  expect(reading.fieldAt).toBeLessThan(completed.at);
  expect(reading.at).toBeGreaterThan(completed.at - 50);
  await expect(page.locator('.hero-actions')).toHaveCSS('opacity', '1', { timeout: 3500 });
  await expect(page.locator('#work-heading')).toHaveCSS('opacity', '1');
});

test('phone text waits for its own viewport and scrolling past completes it', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 640 });
  await page.goto('/');
  const bio = page.locator('.hero-bio [data-typed-text]');
  await expect(page.locator('[data-home-motion]')).toHaveAttribute('data-opening-started', /.+/);
  const box = await bio.boundingBox();
  expect(box!.y).toBeGreaterThan(640);
  await expect(bio).not.toHaveAttribute('data-typing-started', '');
  await bio.scrollIntoViewIfNeeded();
  await expect(bio).toHaveAttribute('data-typing-started', '');
  await expect(bio).not.toHaveAttribute('data-typing-complete', '');
  await page.locator('.work-entry').first().scrollIntoViewIfNeeded();
  await expect(bio).toHaveAttribute('data-typing-complete', '');
  await expect(bio.locator('.intro-letter[data-unseen]')).toHaveCount(0);
});

for (const width of [1280, 375]) {
  test(`View research starts with the first lane light at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    if (width === 375) await page.locator('.research-navigator').scrollIntoViewIfNeeded();
    const timing = await page.evaluate(
      () =>
        new Promise<{ action: number; light: number }>((resolve) => {
          const action = document.querySelector('.hero-actions')!;
          const light = document.querySelector('.research-topic .lane-light-window')!;
          let lightAt: number | undefined;
          const sample = () => {
            const illumination = light.getAnimations()[0];
            if (typeof illumination?.startTime === 'number')
              lightAt = illumination.startTime + Number(illumination.effect!.getTiming().delay);
            const entrance = action.getAnimations()[0];
            if (typeof entrance?.startTime === 'number' && lightAt !== undefined)
              resolve({ action: entrance.startTime, light: lightAt });
            else requestAnimationFrame(sample);
          };
          sample();
        }),
    );
    expect(Math.abs(timing.action - timing.light)).toBeLessThan(100);
  });
}

test('phone lanes keep their stagger when scrolled into view later', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 640 });
  await recordAttribute(page, 'data-connecting');
  await page.goto('/');
  await expect(page.locator('[data-home-motion]')).not.toHaveAttribute('data-opening', /.*/);
  await expect(page.locator('.research-topic[data-connecting]')).toHaveCount(3);
  await page.locator('.research-navigator').scrollIntoViewIfNeeded();
  await expect(page.locator('.hero-bio [data-typed-text]')).toHaveAttribute(
    'data-typing-complete',
    '',
    { timeout: 14000 },
  );
  await expect(page.locator('.research-topic[data-connecting]')).toHaveCount(0);
  const connected = (await attributeChanges(page, 'data-connecting')).filter(({ on }) => !on);
  expect(connected).toHaveLength(3);
  expect(connected[1].at - connected[0].at).toBeGreaterThan(50);
  expect(connected[2].at - connected[1].at).toBeGreaterThan(50);
});

test('the bio keeps the text standard and sits above the lanes at every width', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1280, 800, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const bio = await page.locator('.hero-bio').boundingBox();
    const lanes = await page.locator('.research-navigator').boundingBox();
    const actions = await page.locator('.hero-actions').boundingBox();
    expect(bio).not.toBeNull();
    expect(lanes!.y).toBeGreaterThanOrEqual(bio!.y + bio!.height);
    expect(actions!.y).toBeGreaterThanOrEqual(lanes!.y + lanes!.height);
    const styles = await page.locator('.hero-intro, .hero-bio').evaluateAll((paragraphs) =>
      paragraphs.map((paragraph) => {
        const style = getComputedStyle(paragraph);
        return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.color];
      }),
    );
    expect(styles[0]).toEqual(styles[1]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
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

test('scrolling on reveals reading units without waiting for the introduction', async ({
  page,
}) => {
  // Regression: a lost reading cue once left everything below the hero transparent.
  await page.goto('/');
  for (const selector of ['.work-entry', '.about', '.site-footer']) {
    const unit = page.locator(selector).first();
    await unit.scrollIntoViewIfNeeded();
    await expect(unit, selector).toHaveCSS('opacity', '1', { timeout: 10000 });
  }
});
