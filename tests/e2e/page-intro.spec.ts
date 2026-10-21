import { expect, test } from '@playwright/test';
import { routes } from '../../src/data/navigation';

interface TypingSample {
  text: string;
  height: number;
  visible: boolean;
  caretGap: number;
}

declare global {
  interface Window {
    typingSamples: TypingSample[];
  }
}

const contentPages = Object.values(routes).filter((route) => route !== routes.home);
const pages = [...contentPages, '/404.html'];

/** Reads text fragments rather than element boxes, so block-level line breaks count once. */
function renderedLines(element: Element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const lines = new Map<number, string>();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? '';
    for (let i = 0; i < text.length; i++) {
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const box = range.getBoundingClientRect();
      if (!box.width) continue;
      const top = Math.round(box.top);
      lines.set(top, (lines.get(top) ?? '') + text[i]);
    }
  }
  return [...lines.values()].map((line) => line.trim()).filter(Boolean);
}

for (const [route, first, second] of [
  [routes.software, 'Open-source libraries', 'for learning and optimization.'],
  [routes.about, 'Who I am', 'and what I work on.'],
  [routes.research, 'The questions I study,', 'and the papers that answer them.'],
]) {
  test(`${route} keeps its mobile introduction on two intentional lines`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    const copy = page.locator('[data-page-intro] .intro-copy');
    await expect(copy).toHaveText(`${first} ${second}`);
    expect(await copy.evaluate(renderedLines)).toEqual([`${first} ${second}`]);
    for (const width of [320, 375, 430, 720]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await copy.evaluate(renderedLines)).toEqual([first, second]);
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    await expect(page.locator('[data-page-intro] [data-typed-text]')).toHaveAttribute(
      'data-typing-ready',
      '',
    );
    await page.evaluate(() => document.fonts.ready);
    const typed = page.locator('[data-page-intro] [data-intro-typed]');
    for (const width of [320, 430, 720, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const expected = width <= 720 ? [first, second] : [`${first} ${second}`];
      expect(await copy.evaluate(renderedLines)).toEqual(expected);
      expect(await typed.evaluate(renderedLines)).toEqual(expected);
    }
  });
}

for (const width of [1280, 375]) {
  for (const route of contentPages) {
    test(`${route} lets the introduction type briefly before body content arrives at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((handedOver) => {
        if (handedOver)
          sessionStorage.setItem(
            'page-title-from',
            JSON.stringify({ to: location.href, title: 'Software', at: Date.now() }),
          );
        document.addEventListener('DOMContentLoaded', () => {
          const intro = document.querySelector('[data-page-intro] [data-typed-text]')!;
          const body = document.querySelector<HTMLElement>(
            '[data-reveal-root] [data-reveal]:not([data-reveal="title"]):not([data-page-intro])',
          )!;
          const sample = (now: number) => {
            if (intro.hasAttribute('data-typing-started') && !body.dataset.testTypingAt)
              body.dataset.testTypingAt = String(now);
            if (
              getComputedStyle(body).visibility === 'visible' &&
              Number(getComputedStyle(body).opacity) > 0.05
            ) {
              body.dataset.testBodyAt = String(now);
              body.dataset.testTypingComplete = String(intro.hasAttribute('data-typing-complete'));
              return;
            }
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
      }, width === 375);
      await page.goto(route);
      const warming = page.locator('[data-arrival-warm]');
      await expect(warming).not.toHaveCount(0);
      expect(await warming.count()).toBeLessThanOrEqual(2);
      const body = page.locator('[data-test-body-at]');
      await expect(body).toBeAttached();
      const timing = await body.evaluate((element) => ({ ...(element as HTMLElement).dataset }));
      expect(
        timing.testTypingAt,
        'the introduction starts typing before body content arrives',
      ).toBeDefined();
      expect(Number(timing.testBodyAt) - Number(timing.testTypingAt)).toBeGreaterThan(450);
      expect(Number(timing.testBodyAt) - Number(timing.testTypingAt)).toBeLessThan(1200);
      expect(timing.testTypingComplete).toBe('false');
      await expect(warming).toHaveCount(0);
    });
  }
}

const cases = [
  ...pages.map((route) => ({ route, scriptDelay: 0 })),
  { route: routes.software, scriptDelay: 1200 },
];

for (const { route, scriptDelay } of cases) {
  test(`${route} types alongside its entrance without typos or reflow (script delay ${scriptDelay}ms)`, async ({
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
          visible:
            getComputedStyle(intro).visibility === 'visible' &&
            Number(getComputedStyle(intro).opacity) > 0,
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
    expect(samples.every(({ visible }) => visible)).toBe(true);
    expect(samples.every(({ caretGap }) => Math.abs(caretGap - 3) < 0.1)).toBe(true);
    const heights = samples.map(({ height }) => height);
    // Translated rectangles can differ by tiny floating-point fractions without any reflow.
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.1);
    expect(samples.at(-1)?.text).toBe(await intro.locator('.intro-copy').textContent());
  });
}

test('keyboard focus completes an introduction immediately', async ({ page }) => {
  await page.goto(routes.software);
  await expect(page.locator('[data-typing-ready]')).toBeAttached();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-arrival-warm]')).toHaveCount(0);
  await expect(page.locator('[data-page-intro] [data-typed-text]')).toHaveAttribute(
    'data-typing-complete',
    '',
  );
  await expect(page.locator('[data-page-intro] .intro-letter[data-unseen]')).toHaveCount(0);
});

test('the caret follows wrapped text after resizing, including after typing ends', async ({
  page,
}) => {
  await page.goto(routes.research);
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

test('without Web Animations, the introduction remains readable without page errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'animate', { value: undefined, configurable: true });
  });
  await page.goto(routes.software);
  await expect(page.locator('[data-page-intro] .intro-copy')).toBeVisible({ timeout: 500 });
  expect(errors).toEqual([]);
});

test('the home caret stays aligned after resizing during its typo and correction', async ({
  page,
}) => {
  await page.goto(routes.home);
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
