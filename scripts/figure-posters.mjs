// Capture the real paused first frame; run against an up-to-date local preview after artwork changes.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { researchFigures } from '../src/data/research/figures.ts';

const origin = process.env.FIGURE_PREVIEW_URL || 'http://127.0.0.1:4321';
const output = new URL('../src/assets/figure-posters/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
try {
  for (const [kind, figure] of Object.entries(researchFigures)) {
    const compact = figure.fitting.compactCanvas ?? {
      width: 330 + 2 * figure.canvas.bleed,
      height: kind === 'dfl' ? 704 : figure.canvas.height,
    };
    for (const [name, size] of Object.entries({ wide: figure.canvas, compact })) {
      const context = await browser.newContext({
        viewport: size,
        deviceScaleFactor: 2,
        reducedMotion: 'no-preference',
      });
      const page = await context.newPage();
      await page.route('**/__figure-poster__', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: `<div data-screen-reveal data-screen-pending><iframe src="${figure.src}" width="${size.width}" height="${size.height}" style="border:0"></iframe></div><style>html,body{margin:0}</style>`,
        }),
      );
      await page.goto(new URL('/__figure-poster__', origin).href);
      const frame = page.frameLocator('iframe');
      await frame.locator('[data-figure-drawn]').first().waitFor();
      await page.waitForFunction(() => {
        const inner = document.querySelector('iframe').contentDocument;
        const renderers = [...inner.querySelectorAll('[data-figure-drawn]')];
        return (
          renderers.length > 0 &&
          renderers.every((node) => node.getAttribute('data-figure-drawn') === '')
        );
      });
      await frame.locator('body').evaluate(async () => {
        await document.fonts.ready;
        await Promise.allSettled([...document.images].map((image) => image.decode()));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const png = await page.screenshot({
        clip: { x: 0, y: 0, width: size.width, height: size.height },
      });
      const webp = await sharp(png).webp({ quality: 90 }).toBuffer();
      await writeFile(new URL(`${kind}-${name}.webp`, output), webp);
      console.log(`${kind}-${name}: ${(webp.length / 1024).toFixed(1)}KB`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
