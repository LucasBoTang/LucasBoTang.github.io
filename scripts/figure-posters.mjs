// Capture the real paused first frame; run against an up-to-date local preview after artwork changes.
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { researchFigures } from '../src/data/research/figures.ts';
import { filesUnder } from './files.mjs';

const origin = process.env.FIGURE_PREVIEW_URL || 'http://127.0.0.1:4321';
const output = new URL('../src/assets/figure-posters/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
// Fluid artwork reflows inside the iframe. Two-pixel samples bound crop and internal drift;
// wide and minimum-width compositions still share one image at every display scale.
const phoneRange = { min: 280, max: 540, step: 2 };
const phoneWidths = Array.from(
  { length: (phoneRange.max - phoneRange.min) / phoneRange.step + 1 },
  (_, index) => phoneRange.min + phoneRange.step * index,
);
phoneWidths.push(375, 393);
const manifest = Object.fromEntries(Object.keys(researchFigures).map((kind) => [kind, []]));

async function capture(kind, figure, name, size) {
  const context = await browser.newContext({
    viewport: { width: Math.ceil(size.width), height: size.height },
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
  });
  try {
    const page = await context.newPage();
    await page.route('**/__figure-poster__', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<div data-screen-reveal data-screen-pending><iframe src="${figure.src}" style="width:${size.width}px;height:${size.height}px;border:0"></iframe></div><style>html,body{margin:0}</style>`,
      }),
    );
    await page.goto(new URL('/__figure-poster__', origin).href);
    await page.waitForFunction(() => {
      const inner = document.querySelector('iframe').contentDocument;
      const renderers = [...inner.querySelectorAll('[data-figure-drawn]')];
      return (
        renderers.length > 0 &&
        renderers.every((node) => node.getAttribute('data-figure-drawn') === '')
      );
    });
    await page
      .frameLocator('iframe')
      .locator('body')
      .evaluate(async () => {
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
  } finally {
    await context.close();
  }
}

try {
  // Measure the existing fitted iframe rather than duplicating gutter and breakpoint math.
  const layoutContext = await browser.newContext({ reducedMotion: 'reduce' });
  const layout = await layoutContext.newPage();
  for (const figure of Object.values(researchFigures))
    await layout.route(`**${figure.src}`, (route) => route.abort());
  await layout.goto(new URL('/research/', origin).href);
  await layout.evaluate(() => document.fonts.ready);
  const sizes = {};
  async function measure(width) {
    if (sizes[width]) return sizes[width];
    await layout.setViewportSize({ width, height: 900 });
    await layout.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    sizes[width] = await layout.locator('[data-scalable-figure]').evaluateAll((frames) =>
      frames.map((frame) => {
        const fitting = JSON.parse(frame.dataset.figureFit);
        const available = frame.getBoundingClientRect().width;
        const style = getComputedStyle(frame.querySelector('iframe'));
        return {
          kind: frame.dataset.scalableFigure,
          available,
          compact: available <= fitting.compactAt,
          scaled: frame.hasAttribute('data-scaled'),
          width: parseFloat(style.width),
          height: parseFloat(style.height),
        };
      }),
    );
    return sizes[width];
  }
  // Include both sides of CSS layout and GPU SVG label/tick changes, in content coordinates.
  const boundaries = { gpu: [320, 339, 379, 480], dfl: [290, 420], l2o: [330, 420] };
  for (const [kind, widths] of Object.entries(boundaries)) {
    for (const contentWidth of widths) {
      let below = phoneRange.min,
        above = 720;
      while (above - below > 1) {
        const middle = Math.floor((below + above) / 2);
        const current = (await measure(middle)).find((item) => item.kind === kind);
        if (current.available <= contentWidth) below = middle;
        else above = middle;
      }
      phoneWidths.push(below, above);
    }
  }
  phoneWidths.sort((a, b) => a - b);
  const uniqueWidths = [...new Set(phoneWidths)];
  for (const width of uniqueWidths) await measure(width);
  await layoutContext.close();
  for (const [kind, figure] of Object.entries(researchFigures)) {
    await capture(kind, figure, 'wide', figure.canvas);
    if (figure.fitting.compactCanvas)
      await capture(kind, figure, 'compact', figure.fitting.compactCanvas);
    for (const viewport of uniqueWidths) {
      const size = sizes[viewport].find((item) => item.kind === kind);
      if (!size.compact) continue;
      const file = size.scaled ? `${kind}-compact.webp` : `${kind}-phone-${viewport}.webp`;
      if (!size.scaled) await capture(kind, figure, `phone-${viewport}`, size);
      const entries = manifest[kind];
      if (entries.at(-1)?.file === file) entries.at(-1).maxViewport = viewport;
      else entries.push({ maxViewport: viewport, file, width: size.width, height: size.height });
    }
  }
  const used = new Set(
    Object.values(manifest)
      .flat()
      .map(({ file }) => file),
  );
  for (const file of filesUnder(fileURLToPath(output), /^(gpu|dfl|l2o)-phone-\d+\.webp$/))
    if (!used.has(basename(file))) await unlink(file);
  await writeFile(
    new URL('../src/data/research/figure-posters.json', import.meta.url),
    JSON.stringify(manifest, null, 2) + '\n',
  );
} finally {
  await browser.close();
}
