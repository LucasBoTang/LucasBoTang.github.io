import { expect, test } from '@playwright/test';

interface TypingSample {
  text: string;
  height: number;
  entering: boolean;
  caretGap: number;
}

declare global {
  interface Window {
    typingSamples: TypingSample[];
  }
}

const pages = ['/research/', '/software/', '/about/', '/404.html'];

const cases = [
  ...pages.map((route) => ({ route, scriptDelay: 0 })),
  { route: '/software/', scriptDelay: 1200 },
];

for (const { route, scriptDelay } of cases) {
  test(`${route} types after arriving without typos or reflow (script delay ${scriptDelay}ms)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    if (scriptDelay) {
      await page.route('**/SiteLayout*.js', async (request) => {
        await new Promise((resolve) => setTimeout(resolve, scriptDelay));
        await request.continue();
      });
    }
    await page.addInitScript(() => {
      window.typingSamples = [];
      new MutationObserver(() => {
        const intro = document.querySelector('[data-page-intro]');
        if (!intro) return;
        const letters = intro.querySelectorAll('.intro-letter:not([data-unseen])');
        const text = Array.from(letters, (letter) => letter.textContent).join('');
        if (!text || window.typingSamples.at(-1)?.text === text) return;
        window.typingSamples.push({
          text,
          height: intro.getBoundingClientRect().height,
          entering: intro.getAnimations().some((animation) => animation.playState !== 'finished'),
          caretGap:
            intro.querySelector('.intro-cursor')!.getBoundingClientRect().left -
            letters[letters.length - 1].getBoundingClientRect().right,
        });
      }).observe(document, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
    });
    await page.goto(route);
    const intro = page.locator('[data-page-intro]');
    await expect(intro.locator('[data-typed-text]')).toHaveAttribute('data-typing-complete', '', {
      timeout: 12000,
    });
    const samples = await page.evaluate(() => window.typingSamples);
    const sentence = (await intro.locator('.intro-copy').textContent())!;
    expect(samples.length).toBeGreaterThan(10);
    expect(samples.every(({ text }) => sentence.startsWith(text))).toBe(true);
    expect(
      samples.every(({ text }, i) => i === 0 || text.length > samples[i - 1].text.length),
    ).toBe(true);
    expect(samples.every(({ entering }) => !entering)).toBe(true);
    expect(samples.every(({ caretGap }) => Math.abs(caretGap - 3) < 0.1)).toBe(true);
    expect(new Set(samples.map(({ height }) => height)).size).toBe(1);
    expect(samples.at(-1)?.text).toBe(await intro.locator('.intro-copy').textContent());
  });
}

test('keyboard focus completes an introduction immediately', async ({ page }) => {
  await page.goto('/software/');
  await expect(page.locator('[data-typing-ready]')).toBeAttached();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-page-intro] [data-typed-text]')).toHaveAttribute(
    'data-typing-complete',
    '',
  );
  await expect(page.locator('[data-page-intro] .intro-letter[data-unseen]')).toHaveCount(0);
});

test('the caret follows wrapped text after resizing, including after typing ends', async ({
  page,
}) => {
  await page.goto('/research/');
  const host = page.locator('[data-page-intro] [data-typed-text]');
  await expect(host).toHaveAttribute('data-typing-started', '');
  for (const width of [320, 1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        host.evaluate((element) => {
          const letters = element.querySelectorAll('.intro-letter:not([data-unseen])');
          const last = letters[letters.length - 1].getBoundingClientRect();
          const caret = element.querySelector('.intro-cursor')!.getBoundingClientRect();
          return (
            Math.abs(caret.left - last.right - 3) < 0.1 &&
            Math.abs(caret.top - last.top - 1.92) < 0.1
          );
        }),
      )
      .toBe(true);
  }
  await expect(host).toHaveAttribute('data-typing-complete', '', { timeout: 12000 });
  await page.setViewportSize({ width: 430, height: 900 });
  await expect
    .poll(() =>
      host.evaluate((element) => {
        const letters = element.querySelectorAll('.intro-letter');
        const last = letters[letters.length - 1].getBoundingClientRect();
        return Math.abs(
          element.querySelector('.intro-cursor')!.getBoundingClientRect().left - last.right - 3,
        );
      }),
    )
    .toBeLessThan(0.1);
});

test('reduced motion leaves every introduction readable without typing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of pages) {
    await page.goto(route);
    await expect(page.locator('[data-page-intro] .intro-copy')).toBeVisible();
    await expect(page.locator('[data-page-intro] [data-typing-ready]')).toHaveCount(0);
  }
});

test('the home caret stays aligned after resizing during its typo and correction', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(
    () => document.querySelector('[data-intro-typed]')?.textContent?.includes('algorithsm'),
    undefined,
    { timeout: 12000 },
  );
  await page.setViewportSize({ width: 1000, height: 900 });
  const host = page.locator('[data-home-motion] [data-typed-text]');
  await expect(host).toHaveAttribute('data-typing-complete', '', { timeout: 12000 });
  await expect
    .poll(() =>
      host.evaluate((element) => {
        const letters = element.querySelectorAll('.intro-letter');
        const last = letters[letters.length - 1].getBoundingClientRect();
        return Math.abs(
          element.querySelector('.intro-cursor')!.getBoundingClientRect().left - last.right - 3,
        );
      }),
    )
    .toBeLessThan(0.1);
  expect(await host.locator('[data-intro-typed]').textContent()).toBe(
    await host.locator('.intro-copy').textContent(),
  );
});
