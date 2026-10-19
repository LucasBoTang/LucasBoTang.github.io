import type { Page } from '@playwright/test';

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
