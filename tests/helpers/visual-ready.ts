import { expect, type Page } from '@playwright/test';

/** Wait for static figure drawing and font/image decoding before comparing pixels. */
export async function waitForPicture(page: Page) {
  for (const frame of page.frames()) {
    await frame.evaluate(async () => {
      await document.fonts.ready;
      await Promise.allSettled(
        [...document.images]
          .filter((image) => image.loading !== 'lazy' || image.complete)
          .map((image) => image.decode()),
      );
    });
    const renderers = frame.locator('[data-figure-drawn]');
    for (const renderer of await renderers.all())
      await expect(renderer).toHaveAttribute('data-figure-drawn', '');
  }
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
