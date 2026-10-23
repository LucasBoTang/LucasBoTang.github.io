import { expect, test } from '@playwright/test';
import { openingTiming } from '../../src/components/home/opening/opening';
import { routes } from '../../src/data/navigation';
import { attributeChanges, openingStartedAt, recordAttribute, watchErrors } from './helpers';

// The home opening: the portrait develops and glitches into the photograph and the name decodes;
// desktop lanes follow the portrait and bio; reading joins the action's fade.

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

test('a site return retains its original first-light action and settled-lane reading handoff', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  await page.goto(routes.research);
  await page.locator('.site-header-name').click();
  await expect(page.locator('html')).toHaveAttribute('data-header-persistent', '');
  const timing = await page.evaluate(
    () =>
      new Promise<{ field: number; action: number; reading: number }>((resolve) => {
        const field = document.querySelector('.research-topic .lane-field')!;
        const action = document.querySelector('.hero-actions')!;
        const reading = document.querySelector('#work-heading')!;
        const times: (number | undefined)[] = [];
        const sample = () => {
          [field, action, reading].forEach((element, index) => {
            const start = element.getAnimations()[0]?.startTime;
            if (typeof start === 'number') times[index] = start;
          });
          if (times.length === 3 && [...times].every((time) => typeof time === 'number'))
            resolve({
              field: Number(times[0]),
              action: Number(times[1]),
              reading: Number(times[2]),
            });
          else requestAnimationFrame(sample);
        };
        sample();
      }),
  );
  expect(Math.abs(timing.action - timing.field - openingTiming.laneLightDelay)).toBeLessThan(100);
  const settled =
    openingTiming.laneOffsets.at(-1)! +
    Math.max(openingTiming.laneField, openingTiming.laneLightDelay + openingTiming.laneLight);
  expect(Math.abs(timing.reading - timing.field - settled)).toBeLessThan(100);
});

test('the portrait develops, then the photograph takes over with nothing left on the canvas', async ({
  page,
}) => {
  await page.goto('/');
  const hero = page.locator('[data-home-motion]');
  await expect(hero).toHaveAttribute('data-opening-started', /.+/, { timeout: 8000 });
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
  await expect(decode).toBeAttached({ timeout: 8000 });
  await expect(decode).not.toBeAttached({ timeout: 6000 });
  await expect(page.locator('h1 .name-base')).toHaveCSS('opacity', '1');
  await expect(page.locator('h1')).toHaveAccessibleName('Bo Tang');
});

test('the bio joins the affiliation during the fold and the portrait starts on landing', async ({
  page,
}, testInfo) => {
  await recordAttribute(page, 'data-typing-started');
  await recordAttribute(page, 'data-typing-complete');
  await recordAttribute(page, 'data-greeting-opening');
  await recordAttribute(page, 'data-opening');
  await page.goto('/');
  // Watch before the greeting lands; starting this sampler after the typing assertions misses
  // an immediate first frame and reports the test's own polling delay as an entrance delay.
  const firstPaint = page.locator('[data-portrait-develop]').evaluate(
    (canvas: HTMLCanvasElement) =>
      new Promise<number>((resolve) => {
        const sample = () => {
          const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
          if (pixels.data.some((value, i) => i % 4 === 3 && value > 0)) resolve(performance.now());
          else requestAnimationFrame(sample);
        };
        sample();
      }),
  );
  await expect(page.locator('.hero-bio [data-typed-text]')).toHaveAttribute(
    'data-typing-started',
    '',
  );
  const greetingAt = (await attributeChanges(page, 'data-typing-started')).find(({ on }) => on)!.at;
  const bioAt = (await attributeChanges(page, 'data-typing-started'))
    .filter(({ on }) => on)
    .at(-1)!.at;
  const greetedAt = (await attributeChanges(page, 'data-typing-complete')).find(({ on }) => on)!.at;
  const affiliationAt = await page.locator('.affiliation').evaluate((element) => {
    const entrance = element.getAnimations()[0];
    return Number(entrance.startTime) + Number(entrance.effect!.getTiming().delay);
  });
  await expect(page.locator('.hero-intro')).not.toHaveAttribute('data-greeting-opening');
  const landedAt = (await attributeChanges(page, 'data-greeting-opening')).find(
    ({ on }) => !on,
  )!.at;
  expect(greetedAt - greetingAt).toBeGreaterThan(300);
  expect(Math.abs(affiliationAt - greetedAt - openingTiming.greetingRest)).toBeLessThan(80);
  expect(affiliationAt).toBeLessThan(landedAt);
  expect(Math.abs(bioAt - affiliationAt)).toBeLessThan(100);
  expect(landedAt - bioAt).toBeGreaterThan(openingTiming.greetingFold - 100);
  const hero = page.locator('[data-home-motion]');
  await expect(hero).toHaveAttribute('data-opening-started', /.+/);
  const openingAt = await openingStartedAt(page);
  const paintedAt = await firstPaint;
  // Reproduce the reported frame: at "scalable", the canvas must still be changing,
  // rather than merely keeping an opening marker on an already settled photograph.
  const developing = await page.locator('[data-portrait-develop]').evaluate(
    (canvas: HTMLCanvasElement) =>
      new Promise<boolean>((resolve) => {
        const sample = () => {
          const typed = document.querySelector('.hero-bio [data-intro-typed]')!;
          const visible = [...typed.querySelectorAll('.intro-letter:not([data-unseen])')]
            .map((letter) => letter.textContent)
            .join('');
          if (!visible.includes('scalab')) return void requestAnimationFrame(sample);
          const context = canvas.getContext('2d')!;
          const before = context.getImageData(0, 0, canvas.width, canvas.height).data;
          setTimeout(() => {
            const after = context.getImageData(0, 0, canvas.width, canvas.height).data;
            resolve(
              before.some((value, i) => i % 4 === 3 && value > 0) &&
                after.some((value, i) => value !== before[i]),
            );
          }, 120);
        };
        sample();
      }),
  );
  expect(developing).toBe(true);
  await testInfo.attach('portrait-during-bio', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  const { laneAt, lightAt } = await page.evaluate(
    () =>
      new Promise<{ laneAt: number; lightAt: number }>((resolve) => {
        const field = document.querySelector('.research-topic .lane-field')!;
        const light = document.querySelector('.research-topic .lane-light-window')!;
        const sample = () => {
          const entrance = field.getAnimations()[0];
          const illumination = light.getAnimations()[0];
          // playState can be 'running' while play is pending and startTime is still null.
          // Wait for both timestamps together; Number(null) would invent a start at page load.
          if (
            typeof entrance?.startTime === 'number' &&
            typeof illumination?.startTime === 'number'
          )
            resolve({
              laneAt: entrance.startTime,
              lightAt: illumination.startTime + Number(illumination.effect!.getTiming().delay),
            });
          else requestAnimationFrame(sample);
        };
        sample();
      }),
  );
  await expect(page.locator('.hero-bio [data-typed-text]')).toHaveAttribute(
    'data-typing-complete',
    '',
  );
  const portraitEnd = (await attributeChanges(page, 'data-opening')).find(({ on }) => !on)!.at;
  const bioEnd = (await attributeChanges(page, 'data-typing-complete'))
    .filter(({ on }) => on)
    .at(-1)!.at;
  const beforePortrait = paintedAt - bioAt;
  const afterPortrait = laneAt - portraitEnd;
  expect(Math.abs(openingAt - landedAt)).toBeLessThan(100);
  expect(beforePortrait).toBeGreaterThanOrEqual(0);
  expect(beforePortrait).toBeGreaterThan(openingTiming.greetingFold - 100);
  expect(beforePortrait).toBeLessThan(openingTiming.greetingFold + 120);
  expect(portraitEnd - openingAt).toBeGreaterThan(1400);
  expect(portraitEnd - openingAt).toBeLessThan(1560);
  expect(bioEnd - portraitEnd).toBeLessThan(650);
  expect(afterPortrait).toBeGreaterThan(openingTiming.portraitRest - 40);
  expect(Math.abs(bioEnd - laneAt)).toBeLessThan(300);
  expect(Math.abs(bioEnd - lightAt)).toBeLessThan(300);
  await testInfo.attach('opening-timing', {
    body: JSON.stringify({
      beforePortrait,
      portraitEffect: portraitEnd - paintedAt,
      afterPortrait,
      laneLead: bioEnd - laneAt,
      lightLead: bioEnd - lightAt,
    }),
    contentType: 'application/json',
  });
});

test('bio typing prepares the lower sign before it is shown, without starting its motion', async ({
  page,
}) => {
  await page.goto('/');
  const bio = page.locator('.hero-bio [data-typed-text]');
  await expect(bio).toHaveAttribute('data-typing-started', '');
  const sign = page.locator('[data-decision-sign] svg');
  await expect(sign).toHaveAttribute('data-sign-ready', '', { timeout: 1500 });
  await expect(bio).not.toHaveAttribute('data-typing-complete');
  await expect(sign).not.toHaveAttribute('data-sign-state');
  await expect(page.locator('[data-opening-part="about"]')).toHaveCSS('opacity', '0');
  const clips = await sign
    .locator('clipPath')
    .evaluateAll((elements) => elements.map((element) => element.id));
  expect(new Set(clips).size).toBe(clips.length);
  await sign.scrollIntoViewIfNeeded();
  await expect(sign).toHaveAttribute('data-sign-state', /.+/);
  expect(
    await sign.locator('clipPath').evaluateAll((elements) => elements.map((element) => element.id)),
  ).toEqual(clips);
});

test('the home bio keeps typing at a readable pace while the portrait develops', async ({
  page,
}) => {
  await recordAttribute(page, 'data-typing-complete');
  await recordAttribute(page, 'data-typing-started');
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
  const bioAt = (await attributeChanges(page, 'data-typing-started'))
    .filter(({ on }) => on)
    .at(-1)!.at;
  expect(completed[1].at - bioAt).toBeGreaterThan(1800);
  expect(completed[1].at - bioAt).toBeLessThan(5000);
});

test('one brief home typo corrects before the portrait starts tearing', async ({ page }) => {
  await page.goto('/');
  const correction = await page.locator('.hero-bio [data-typed-text]').evaluate(
    (host) =>
      new Promise<{ typoAt?: number; correctedAt?: number; portraitAt: number }>((resolve) => {
        let typoAt: number | undefined;
        let correctedAt: number | undefined;
        const sample = () => {
          const visible = [...host.querySelectorAll('.intro-letter:not([data-unseen])')]
            .map((letter) => letter.textContent)
            .join('');
          if (visible.includes('learnign')) typoAt ??= performance.now();
          if (typoAt !== undefined && visible.includes('learning'))
            correctedAt ??= performance.now();
          if (host.hasAttribute('data-typing-complete'))
            resolve({
              typoAt,
              correctedAt,
              portraitAt: Number(
                host.closest<HTMLElement>('[data-home-motion]')!.dataset.openingStarted,
              ),
            });
          else requestAnimationFrame(sample);
        };
        sample();
      }),
  );
  expect(correction.typoAt).toBeDefined();
  expect(correction.correctedAt! - correction.typoAt!).toBeGreaterThan(160);
  expect(correction.correctedAt! - correction.typoAt!).toBeLessThan(280);
  expect(correction.correctedAt! - correction.portraitAt).toBeLessThan(280);
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

test('narrowing to a phone keeps the active greeting and releases the portrait on landing', async ({
  page,
}) => {
  await page.goto('/');
  const hero = page.locator('[data-home-motion]');
  const greeting = page.locator('.hero-intro [data-typed-text]');
  await expect(greeting).toHaveAttribute('data-typing-started', '');
  await page.setViewportSize({ width: 375, height: 640 });
  await expect(page.locator('.hero-intro')).toHaveAttribute('data-greeting-opening', '');
  await expect(hero).toHaveAttribute('data-opening-started', /.+/, { timeout: 4000 });
  await expect(greeting).toHaveAttribute('data-typing-complete', '');
  await expect(page.locator('html')).not.toHaveAttribute('data-greeting-locked');
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

test('the bio tail releases the lanes, then the action, then reading', async ({ page }) => {
  await recordAttribute(page, 'data-typing-complete');
  await recordAttribute(page, 'data-opening');
  await page.goto('/');
  const bio = page.locator('.hero-bio [data-typed-text]');
  const reading = await page.evaluate(
    () =>
      new Promise<{
        at: number;
        fieldAt: number;
        affiliationAt: number;
        lightEnd: number;
        actionAt: number;
        actionEnd: number;
        textComplete: boolean;
      }>((resolve) => {
        const heading = document.querySelector('#work-heading')!;
        const affiliation = document.querySelector('.affiliation')!;
        const field = document.querySelector('.research-topic .lane-field')!;
        const light = document.querySelector('.research-topic:last-child .lane-light-window')!;
        const text = document.querySelector('.hero-bio [data-typed-text]')!;
        const action = document.querySelector('.hero-actions')!;
        let lightEnd: number | undefined;
        let fieldAt: number | undefined;
        let affiliationAt: number | undefined;
        let actionAt: number | undefined;
        let actionEnd: number | undefined;
        const sample = () => {
          const identity = affiliation.getAnimations()[0];
          if (typeof identity?.startTime === 'number')
            affiliationAt = identity.startTime + Number(identity.effect!.getTiming().delay);
          const fieldOpening = field.getAnimations()[0];
          if (fieldAt === undefined && typeof fieldOpening?.startTime === 'number') {
            fieldAt = fieldOpening.startTime;
          }
          const illumination = light.getAnimations()[0];
          if (typeof illumination?.startTime === 'number')
            lightEnd =
              illumination.startTime + Number(illumination.effect!.getComputedTiming().endTime);
          const entrance = heading.getAnimations()[0];
          const actionEntrance = action.getAnimations()[0];
          if (typeof actionEntrance?.startTime === 'number') {
            actionAt = actionEntrance.startTime;
            actionEnd = actionAt + Number(actionEntrance.effect!.getComputedTiming().endTime);
          }
          if (
            typeof entrance?.startTime === 'number' &&
            lightEnd !== undefined &&
            fieldAt !== undefined &&
            affiliationAt !== undefined &&
            actionAt !== undefined &&
            actionEnd !== undefined
          )
            resolve({
              at: entrance.startTime,
              fieldAt,
              affiliationAt,
              lightEnd,
              actionAt,
              actionEnd,
              textComplete: text.hasAttribute('data-typing-complete'),
            });
          else requestAnimationFrame(sample);
        };
        sample();
      }),
  );
  expect(reading.textComplete).toBe(true);
  expect(reading.fieldAt).toBeGreaterThan(reading.affiliationAt);
  expect(Math.abs(reading.lightEnd - reading.actionAt - openingTiming.actionLead)).toBeLessThan(
    100,
  );
  expect(Math.abs(reading.at - reading.actionAt - openingTiming.readingDelay)).toBeLessThan(80);
  expect(reading.at).toBeLessThan(reading.actionEnd);
  await expect(bio).toHaveAttribute('data-typing-complete', '', { timeout: 14000 });
  await expect(page.locator('.research-topic[data-connecting]')).toHaveCount(0);
  const completed = (await attributeChanges(page, 'data-typing-complete'))
    .filter(({ on }) => on)
    .at(-1)!;
  const portraitEnd = (await attributeChanges(page, 'data-opening')).find(({ on }) => !on)!.at;
  const lanesReadyAt = Math.max(
    completed.at - openingTiming.laneLead,
    portraitEnd + openingTiming.portraitRest,
  );
  expect(Math.abs(reading.fieldAt - lanesReadyAt)).toBeLessThan(100);
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
  test(`View research joins the final lane's tail at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    if (width === 375) await page.locator('.research-navigator').scrollIntoViewIfNeeded();
    const timing = await page.evaluate(
      () =>
        new Promise<{ action: number; lightEnd: number }>((resolve) => {
          const action = document.querySelector('.hero-actions')!;
          const light = document.querySelector('.research-topic:last-child .lane-light-window')!;
          let lightEnd: number | undefined;
          const sample = () => {
            const illumination = light.getAnimations()[0];
            if (typeof illumination?.startTime === 'number')
              lightEnd =
                illumination.startTime + Number(illumination.effect!.getComputedTiming().endTime);
            const entrance = action.getAnimations()[0];
            if (typeof entrance?.startTime === 'number' && lightEnd !== undefined)
              resolve({ action: entrance.startTime, lightEnd });
            else requestAnimationFrame(sample);
          };
          sample();
        }),
    );
    const pace = width === 375 ? 0.8 : 1;
    expect(
      Math.abs(timing.lightEnd - timing.action - openingTiming.actionLead * pace),
    ).toBeLessThan(100);
    await expect(page.locator('.hero-bio [data-typed-text]')).toHaveAttribute(
      'data-typing-complete',
      '',
    );
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
