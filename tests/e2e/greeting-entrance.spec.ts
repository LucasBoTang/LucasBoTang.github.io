import { expect, test } from '@playwright/test';
import { routes } from '../../src/data/navigation';
import {
  attributeChanges,
  expectBlinkingCaret,
  openingStartedAt,
  recordAttribute,
  watchErrors,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('the whole greeting glitches after Bo Tang while typing continues, then settles cleanly', async ({
  page,
}, testInfo) => {
  await page.clock.install();
  await page.goto(routes.home);
  const layer = page.locator('.hero-intro .intro-typing');
  await page.waitForFunction(() =>
    document.querySelector('.hero-intro .intro-typing')?.hasAttribute('data-greeting-glitch'),
  );
  // Hold the burst's clock so its retained frame and correction can both be inspected.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 20)));
  const typedPrefix = () => layer.locator('.intro-letter:not([data-unseen])').allTextContents();
  const before = await typedPrefix();
  const frames: { x: number; y: number; middle: string; lower: string }[] = [];
  const showSignalFrame = (progress: number, play = false) =>
    layer.evaluate(
      (element, { progress, play }) => {
        for (const animation of element.getAnimations({ subtree: true })) {
          if (
            !(animation instanceof CSSAnimation) ||
            !animation.animationName.startsWith('signal-greeting-')
          )
            continue;
          animation.pause();
          animation.currentTime = Number(animation.effect!.getTiming().duration) * progress;
          if (play) animation.play();
        }
      },
      { progress, play },
    );
  for (const [name, phase] of [
    ['greeting-glitch', 0.2],
    ['greeting-glitch-held', 0.55],
    ['greeting-glitch-correction', 0.72],
  ] as const) {
    await showSignalFrame(phase);
    // These are displaced parts of the letters; the intact text must not show behind them.
    await expect(layer.locator('[data-intro-typed]')).not.toHaveCSS('clip-path', 'inset(0px)');
    await expect(layer.locator('[data-intro-typed]')).toHaveCSS('filter', 'none');
    frames.push(
      await layer.evaluate((element) => {
        const { x, y } = element.getBoundingClientRect();
        return {
          x,
          y,
          middle: getComputedStyle(element, '::before').transform,
          lower: getComputedStyle(element, '::after').transform,
        };
      }),
    );
    await testInfo.attach(name, {
      body: await page.screenshot({ path: `.verification/${name}.png` }),
      contentType: 'image/png',
    });
  }
  // The main damaged frame stays put, then the pieces correct without shaking the whole line.
  expect(frames[1]).toEqual(frames[0]);
  expect(frames[2].middle).not.toBe(frames[0].middle);
  expect(frames[2].lower).not.toBe(frames[0].lower);
  expect(frames[2].x).toBe(frames[0].x);
  expect(frames[2].y).toBe(frames[0].y);
  const glitch = await layer.evaluate((element) => ({
    echo: element.getAttribute('data-greeting-signal'),
    animation: getComputedStyle(element.querySelector('[data-intro-typed]')!).animationName,
    upper: getComputedStyle(element, '::before').content,
    lower: getComputedStyle(element, '::after').content,
    cueClear: Array.from(element.querySelectorAll('.intro-letter'))
      .slice(0, 'Hello, this is Bo Tang'.length)
      .every((letter) => getComputedStyle(letter).opacity === '1'),
  }));
  expect(glitch.echo).toMatch(/^Hello, this is Bo Tang/);
  expect(glitch.echo).not.toContain('researcher');
  expect(glitch.animation).toBe('signal-greeting-breakup');
  expect(glitch.upper).toContain('Hello, this is Bo Tang');
  expect(glitch.lower).toContain('Hello, this is Bo Tang');
  expect(glitch.cueClear).toBe(true);
  await showSignalFrame(0, true);
  await page.clock.runFor(120);
  expect((await typedPrefix()).length).toBeGreaterThan(before.length);
  await page.clock.resume();
  await expect(layer).not.toHaveAttribute('data-greeting-glitch');
  await expect(layer).not.toHaveAttribute('data-greeting-signal');
  await expect(page.locator('.hero-intro [data-typed-text]')).toHaveAttribute(
    'data-typing-complete',
    '',
  );
  await expect(page.locator('.hero-intro')).not.toHaveAttribute('data-greeting-opening');
  await expect(layer.locator('[data-intro-typed]')).toHaveCSS('clip-path', 'none');
  await expect(layer.locator('[data-intro-typed]')).toHaveCSS('filter', 'none');
  await expect(layer).not.toHaveAttribute('style');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 17, 19)');
});

test('reduced motion cancels a greeting glitch without leaving offset text or echoes', async ({
  page,
}) => {
  await page.goto(routes.home);
  const layer = page.locator('.hero-intro .intro-typing');
  await page.waitForFunction(() =>
    document.querySelector('.hero-intro .intro-typing')?.hasAttribute('data-greeting-glitch'),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(layer).not.toHaveAttribute('data-greeting-glitch');
  await expect(layer).not.toHaveAttribute('data-greeting-signal');
  await expect(layer).not.toHaveAttribute('style');
  await expect(page.locator('html')).not.toHaveAttribute('data-greeting-locked');
  await expect(page.locator('.hero-intro [data-typed-text]')).toHaveAttribute(
    'data-typing-complete',
    '',
  );
});

test('new greeting letters develop gently without shifting or changing their text standard', async ({
  page,
}) => {
  await page.goto(routes.home);
  const greeting = page.locator('.hero-intro');
  await expect(greeting).toHaveAttribute('data-greeting-opening', '');
  const reveal = await greeting.evaluate(async (paragraph) => {
    return new Promise<{ opacity: number[]; distance: number; duration: number; color: string }>(
      (resolve) => {
        const observer = new MutationObserver((mutations) => {
          const letter = mutations
            .map((mutation) => mutation.target as HTMLElement)
            .find(
              (element) =>
                element.classList.contains('intro-letter') &&
                !element.hasAttribute('data-unseen') &&
                element.textContent?.trim(),
            );
          if (!letter) return;
          observer.disconnect();
          // Compare within the typing layer: a deliberate whole-line glitch may move both.
          const measure = () => {
            const box = letter.getBoundingClientRect();
            const origin = letter.closest('.intro-typing')!.getBoundingClientRect();
            return { x: box.x - origin.x, y: box.y - origin.y };
          };
          const first = measure();
          const opacity: number[] = [];
          const started = performance.now();
          const sample = () => {
            opacity.push(Number(getComputedStyle(letter).opacity));
            if (opacity.at(-1) === 1) {
              const last = measure();
              return resolve({
                opacity,
                distance: Math.hypot(last.x - first.x, last.y - first.y),
                duration: performance.now() - started,
                color: getComputedStyle(letter).color,
              });
            }
            requestAnimationFrame(sample);
          };
          sample();
        });
        observer.observe(paragraph, {
          attributes: true,
          attributeFilter: ['data-unseen'],
          subtree: true,
        });
      },
    );
  });
  expect(reveal.opacity.some((opacity) => opacity > 0 && opacity < 1)).toBe(true);
  expect(reveal.duration).toBeGreaterThanOrEqual(45);
  expect(reveal.duration).toBeLessThan(130);
  expect(reveal.distance).toBeLessThan(0.1);
  expect(reveal.color).toBe('rgb(163, 167, 173)');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 17, 19)');
  await expect(greeting).not.toHaveAttribute('data-greeting-opening');
  await expect(greeting.locator('[data-typed-text]')).not.toHaveAttribute('data-typing-fade');
});

test('reduced motion during a letter reveal finishes clear text and releases the page', async ({
  page,
}) => {
  await page.goto(routes.home);
  const host = page.locator('.hero-intro [data-typed-text]');
  await expect(host).toHaveAttribute('data-typing-started', '');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(host).toHaveAttribute('data-typing-complete', '');
  await expect(host).not.toHaveAttribute('data-typing-fade');
  await expect(page.locator('html')).not.toHaveAttribute('data-greeting-locked');
  await expect
    .poll(() =>
      host
        .locator('.intro-letter')
        .evaluateAll((letters) =>
          letters.every(
            (letter) =>
              getComputedStyle(letter).opacity === '1' &&
              getComputedStyle(letter).visibility === 'visible',
          ),
        ),
    )
    .toBe(true);
});

test('word spacing survives the large greeting and its final paragraph', async ({
  page,
}, testInfo) => {
  await page.goto(routes.home);
  const greeting = page.locator('.hero-intro');
  const gaps = () =>
    greeting.locator('.intro-word').evaluateAll((words) => {
      const boxes = words.map((word) => word.getBoundingClientRect());
      return boxes
        .slice(1)
        .flatMap((box, i) =>
          Math.abs(box.top - boxes[i].top) < 1 ? [box.left - boxes[i].right] : [],
        );
    });
  await expect(greeting).toHaveAttribute('data-greeting-opening', '');
  expect(Math.min(...(await gaps()))).toBeGreaterThan(5);
  await expect(greeting.locator('[data-typed-text]')).toHaveAttribute('data-typing-complete', '');
  await testInfo.attach('greeting-large', {
    body: await page.screenshot({ path: '.verification/greeting-large.png' }),
    contentType: 'image/png',
  });
  await expect(greeting).not.toHaveAttribute('data-greeting-opening');
  expect(Math.min(...(await gaps()))).toBeGreaterThan(2);
  await testInfo.attach('greeting-landed', {
    body: await page.screenshot({ path: '.verification/greeting-landed.png' }),
    contentType: 'image/png',
  });
});

test('the one-line greeting shrinks from the screen centre into its original paragraph', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto(routes.home);
  const greeting = page.locator('.hero-intro');
  await expect(greeting).toHaveAttribute('data-greeting-opening', '');
  const first = greeting.locator('.intro-word').first();
  const profession = greeting.locator('.intro-word').filter({ hasText: /^an$/ });
  const last = greeting.locator('.intro-letter').last();
  const initial = {
    first: (await first.boundingBox())!,
    profession: (await profession.boundingBox())!,
    last: (await last.boundingBox())!,
    bio: (await page.locator('.hero-bio').boundingBox())!,
  };
  expect(Math.abs(initial.profession.y - initial.first.y)).toBeLessThan(1);
  const initialCentre = (initial.first.x + initial.last.x + initial.last.width) / 2;
  expect(Math.abs(initialCentre - 640)).toBeLessThan(2);
  expect(initial.first.y).toBeGreaterThan(320);
  const landing = await greeting.evaluate(async (paragraph) => {
    const letters = Array.from(paragraph.querySelectorAll('.intro-letter'));
    const first = letters[0];
    const last = letters.at(-1)!;
    const measure = () =>
      [first, last].map((letter) => {
        const { x, y, width } = letter.getBoundingClientRect();
        return { x, y, width };
      });
    let before = measure();
    return new Promise<{ before: typeof before; after: typeof before }>((resolve) => {
      const sample = () => {
        if (!paragraph.hasAttribute('data-greeting-opening'))
          return resolve({ before, after: measure() });
        if (paragraph.hasAttribute('data-greeting-folding')) before = measure();
        requestAnimationFrame(sample);
      };
      sample();
    });
  });
  for (let i = 0; i < landing.before.length; i++) {
    expect(Math.abs(landing.before[i].x - landing.after[i].x)).toBeLessThan(0.25);
    expect(Math.abs(landing.before[i].y - landing.after[i].y)).toBeLessThan(0.25);
    expect(Math.abs(landing.before[i].width - landing.after[i].width)).toBeLessThan(0.25);
  }
  await expect(greeting).not.toHaveAttribute('data-greeting-opening', '', { timeout: 6000 });
  const final = {
    first: (await first.boundingBox())!,
    profession: (await profession.boundingBox())!,
    last: (await last.boundingBox())!,
    bio: (await page.locator('.hero-bio').boundingBox())!,
  };
  expect(initial.first.width / final.first.width).toBeGreaterThan(1.5);
  expect(final.first.y).toBeLessThan(initial.first.y);
  const finalCentre = (final.first.x + final.last.x + final.last.width) / 2;
  expect(finalCentre).toBeGreaterThan(initialCentre);
  expect(Math.abs(final.first.y - final.profession.y)).toBeLessThan(1);
  expect(Math.abs(final.bio.y - initial.bio.y)).toBeLessThan(0.1);
  await expect(greeting.locator('[data-typed-text]')).toHaveAttribute('data-typing-complete', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  expect(errors).toEqual([]);
});

test('a short desktop viewport lets the portrait lead without locking on off-screen text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 220 });
  await page.goto(routes.home);
  await expect(page.locator('[data-home-motion]')).toHaveAttribute('data-opening-started', /.+/, {
    timeout: 1500,
  });
  await expect(page.locator('.hero-intro')).not.toHaveAttribute('data-greeting-opening');
  await expect(page.locator('html')).not.toHaveAttribute('data-greeting-locked', '', {
    timeout: 4000,
  });
});

test('a partly visible bio starts the portrait on landing without waiting for unseen typing', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(routes.home);
  await page.evaluate(() => document.fonts.ready.then(() => {}));
  const height = await page
    .locator('.hero-bio [data-typed-text]')
    .evaluate((bio) =>
      Math.ceil(bio.getBoundingClientRect().top + parseFloat(getComputedStyle(bio).lineHeight) / 2),
    );
  await page.setViewportSize({ width: 1280, height });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await recordAttribute(page, 'data-greeting-opening');
  await page.goto(routes.home);
  await expect(page.locator('[data-home-motion]')).toHaveAttribute('data-opening-started', /.+/, {
    timeout: 6000,
  });
  const landed = (await attributeChanges(page, 'data-greeting-opening'))
    .filter(({ on }) => !on)
    .at(-1)!;
  expect(landed).toBeDefined();
  expect(Math.abs((await openingStartedAt(page)) - landed.at)).toBeLessThan(100);
  await expect(page.locator('html')).not.toHaveAttribute('data-greeting-locked');
});

test('a slower font and pending images cannot cancel the greeting preparation', async ({
  page,
}) => {
  let releaseFonts!: () => void;
  let releaseImages!: () => void;
  const fonts = new Promise<void>((resolve) => (releaseFonts = resolve));
  const images = new Promise<void>((resolve) => (releaseImages = resolve));
  await page.route('**/*.woff2', async (request) => {
    await fonts;
    await request.continue();
  });
  await page.route(/\.(?:webp|png)(?:\?|$)/, async (request) => {
    await images;
    await request.continue();
  });
  try {
    await page.goto(routes.home, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    releaseFonts();
    await expect(page.locator('.hero-intro')).toHaveAttribute('data-greeting-opening', '', {
      timeout: 1500,
    });
    await expect(page.locator('.hero-intro [data-typed-text]')).toHaveAttribute(
      'data-typing-started',
      '',
    );
  } finally {
    releaseFonts();
    releaseImages();
  }
  await expect(page.locator('html')).not.toHaveAttribute('data-greeting-locked', '');
});

test('the greeting holds page interactions until it has landed', async ({ page }) => {
  await page.goto(routes.home);
  const greeting = page.locator('.hero-intro');
  await expect(greeting).toHaveAttribute('data-greeting-folding', '', { timeout: 6000 });
  await page.keyboard.press('Tab');
  await page.keyboard.press('PageDown');
  await page.mouse.wheel(0, 700);
  const research = (await page.locator('.site-header a[href="/research/"]').boundingBox())!;
  await page.mouse.click(research.x + research.width / 2, research.y + research.height / 2);
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('.hero-bio [data-typed-text]')).not.toHaveAttribute(
    'data-typing-complete',
  );
  await expect(greeting).not.toHaveAttribute('data-greeting-opening');
  await expect(greeting).not.toHaveAttribute('data-greeting-folding');
  await expect(page.locator('html')).not.toHaveAttribute('data-greeting-locked');
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-home-motion] [data-typing-complete]')).toHaveCount(2);
  await expect(greeting.locator('.intro-word[style]')).toHaveCount(0);
  await expectBlinkingCaret(page.locator('.hero-bio .intro-cursor'));
});

for (const width of [800, 320]) {
  test(`resizing a large greeting to ${width}px adapts and continues the entrance`, async ({
    page,
  }) => {
    await page.goto(routes.home);
    const greeting = page.locator('.hero-intro');
    await expect(greeting).toHaveAttribute('data-greeting-opening', '');
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await expect(greeting).toHaveAttribute('data-greeting-opening', '');
    await expect(greeting.locator('[data-typed-text]')).not.toHaveAttribute('data-typing-complete');
    const first = (await greeting.locator('.intro-letter').first().boundingBox())!;
    const last = (await greeting.locator('.intro-letter').last().boundingBox())!;
    expect(first.x).toBeGreaterThanOrEqual(-1);
    expect(last.x + last.width).toBeLessThanOrEqual(width + 1);
    await expect(greeting).toHaveAttribute('data-greeting-folding', '');
    const foldBounds = await greeting.evaluate(async (paragraph) => {
      let left = Infinity;
      let right = -Infinity;
      return new Promise<{ left: number; right: number }>((resolve) => {
        const sample = () => {
          if (!paragraph.hasAttribute('data-greeting-opening')) return resolve({ left, right });
          paragraph.querySelectorAll('.intro-letter').forEach((letter) => {
            const box = letter.getBoundingClientRect();
            left = Math.min(left, box.left);
            right = Math.max(right, box.right);
          });
          requestAnimationFrame(sample);
        };
        sample();
      });
    });
    expect(foldBounds.left).toBeGreaterThanOrEqual(-1);
    expect(foldBounds.right).toBeLessThanOrEqual(width + 1);
    await expect(greeting).not.toHaveAttribute('data-greeting-opening');
    await expect(greeting.locator('[data-typed-text]')).toHaveAttribute('data-typing-complete', '');
    await expect(greeting.locator('.intro-word[style]')).toHaveCount(0);
    await expect(page.locator('[data-home-motion]')).toHaveAttribute('data-opening-started', /.+/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test('the greeting starts while the portrait is still loading', async ({ page }) => {
  let releaseImages!: () => void;
  const held = new Promise<void>((resolve) => (releaseImages = resolve));
  await page.route(/\.(?:webp|png)(?:\?|$)/, async (request) => {
    await held;
    await request.continue();
  });
  try {
    await page.goto(routes.home, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.hero-intro')).toHaveAttribute('data-greeting-opening', '');
    await expect(page.locator('.hero-intro [data-typed-text]')).toHaveAttribute(
      'data-typing-started',
      '',
    );
    expect(
      await page.locator('.portrait').evaluate((image: HTMLImageElement) => image.complete),
    ).toBe(false);
  } finally {
    releaseImages();
  }
  await expect(page.locator('.hero-intro')).not.toHaveAttribute('data-greeting-opening');
  await expect(page.locator('html')).not.toHaveAttribute('data-greeting-locked');
  await expect(page.locator('[data-home-motion]')).toHaveAttribute('data-opening-started', /.+/);
});
