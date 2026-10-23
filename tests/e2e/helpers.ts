import { expect, type Locator, type Page } from '@playwright/test';

/** One change of a recorded attribute: when, on the page's clock, and whether it was added. */
type AttributeChange = { at: number; on: boolean };

declare global {
  interface Window {
    attributeLog?: Record<string, AttributeChange[]>;
    restoredAt?: number;
  }
}

/** Collects page errors and console errors, ignoring the expected 404 of the missing-page route. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('status of 404'))
      errors.push(message.text());
  });
  return errors;
}

/** A completed introduction keeps its caret visible and blinking while active. */
export async function expectBlinkingCaret(caret: Locator) {
  await expect(caret).toHaveCSS('visibility', 'visible');
  await expect(caret).toHaveCSS('animation-name', /typed-cursor-blink/);
  await expect(caret).toHaveCSS('animation-play-state', 'running');
}

/**
 * Before the next page loads, starts recording each time any element gains or loses `attribute`.
 * Short-lived states, such as a glitch, are caught this way even when polling would miss them.
 */
export async function recordAttribute(page: Page, attribute: string) {
  await page.addInitScript((name) => {
    window.attributeLog ??= {};
    const changes: AttributeChange[] = (window.attributeLog[name] = []);
    new MutationObserver((records) => {
      for (const record of records)
        changes.push({ at: performance.now(), on: (record.target as Element).hasAttribute(name) });
    }).observe(document, { attributes: true, attributeFilter: [name], subtree: true });
  }, attribute);
}

/** The changes recorded for `attribute` so far. */
export const attributeChanges = (page: Page, attribute: string) =>
  page.evaluate((name) => window.attributeLog?.[name] ?? [], attribute);

/** Before the next page loads, starts noting when the page is restored from the back-forward cache. */
export async function recordRestores(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) window.restoredAt = performance.now();
    });
  });
}

/** When the page was last restored from the back-forward cache, if it has been. */
export const restoredAt = (page: Page) => page.evaluate(() => window.restoredAt);

/** When the home opening started, on the page's clock. */
export const openingStartedAt = (page: Page) =>
  page.evaluate(() =>
    Number(document.querySelector<HTMLElement>('[data-home-motion]')?.dataset.openingStarted),
  );

/** The left and right edges of the page grid's columns, read from the site header's grid. */
export const gridColumns = (page: Page) =>
  page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.site-header')!;
    const style = getComputedStyle(grid);
    const gap = parseFloat(style.columnGap);
    let left = grid.getBoundingClientRect().left + parseFloat(style.paddingLeft);
    return style.gridTemplateColumns.split(' ').map((width) => {
      const column = { left, right: left + parseFloat(width) };
      left = column.right + gap;
      return column;
    });
  });

/** The left edge of an element's first line of text, padding and borders aside. */
export const textLeft = (page: Page, selector: string, index = 0) =>
  page.evaluate(
    ([selector, index]) => {
      const element = document.querySelectorAll(selector)[index];
      if (!element) throw new Error(`No element for ${selector} [${index}]`);
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode()) && !node.textContent?.trim());
      if (!node) throw new Error(`No text in ${selector}`);
      const range = document.createRange();
      const start = node.textContent!.search(/\S/);
      range.setStart(node, start);
      range.setEnd(node, start + 1);
      return range.getClientRects()[0].left;
    },
    [selector, index] as const,
  );

/** The first baseline of an element's text, found by a zero-size probe set on that baseline. */
export const firstBaseline = (page: Page, selector: string, index = 0) =>
  page.evaluate(
    ([selector, index]) => {
      const element = document.querySelectorAll(selector)[index];
      const probe = document.createElement('span');
      probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      element.prepend(probe);
      const baseline = probe.getBoundingClientRect().top;
      probe.remove();
      return baseline;
    },
    [selector, index] as const,
  );

/** The lines an element's text takes and the right edge of its widest line, from its text itself. */
export const textExtent = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    return [...document.querySelectorAll(selector)].map((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
      return {
        lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
        right: Math.max(...rects.map((rect) => rect.right)),
      };
    });
  }, selector);

/** Hold matching font responses until the caller releases them, even during a failed test. */
export async function holdFonts(page: Page, pattern: string | RegExp = '**/*.woff2') {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(pattern, async (route) => {
    await ready;
    await route.continue();
  });
  return release;
}

/** Open the first citation in a supplied publication scope. */
export async function openBibtex(scope: Page | Locator) {
  await scope
    .getByRole('button', { name: /^BibTeX:/ })
    .first()
    .click();
}
