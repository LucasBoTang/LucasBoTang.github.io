import { expect, type Page } from '@playwright/test';

/** Measure steady motion only after the opening, typing and visible entrances have finished. */
export async function waitForOpening(page: Page) {
  await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending', '');
  const hero = page.locator('[data-home-motion]');
  if (await hero.count()) {
    await expect(hero).toHaveAttribute('data-opening-started', /.+/, { timeout: 8000 });
    await expect(hero).not.toHaveAttribute('data-opening', '', { timeout: 6000 });
    await expect(page.locator('.research-topic[data-connecting]')).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(page.locator('.hero-actions')).toHaveCSS('opacity', '1');
  } else {
    await expect(page.locator('.software-entry').first()).toHaveCSS('opacity', '1');
  }
  const passages = page.locator(
    '[data-home-motion] [data-typed-text], [data-page-intro] [data-typed-text]',
  );
  for (const passage of await passages.all())
    await expect(passage).toHaveAttribute('data-typing-complete', '', { timeout: 12000 });
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => {
      // Offscreen entrances remain paused; caret blinks and lane drift run indefinitely.
      if (animation.playState !== 'running' && !animation.pending) return true;
      if (!Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))) return true;
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (!(target instanceof Element)) return true;
      const box = target.getBoundingClientRect();
      return box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth;
    }),
  );
}

/** The browser's running totals, such as `LayoutCount` or `ScriptDuration`. */
export async function metrics(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  return async () =>
    Object.fromEntries(
      (await session.send('Performance.getMetrics')).metrics.map(({ name, value }) => [
        name,
        value,
      ]),
    ) as Record<string, number>;
}
