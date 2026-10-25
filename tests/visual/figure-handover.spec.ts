import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { researchFigures } from '../../src/data/research/figures';
import { waitForPicture } from '../helpers/visual-ready';

test.use({ reducedMotion: 'no-preference' });

// Compare a visible poster with a paused live document at the same fitted size. Unlike a box
// assertion, this catches responsive changes inside the artwork, including text and chart axes.
for (const width of [375, 386, 387, 426, 427, 431]) {
  for (const [kind, figure] of Object.entries(researchFigures)) {
    test(`${kind} hands over its first frame at ${width}px`, async ({ page, context }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 900 });
      await page.route(`**${figure.src}`, (route) => route.abort());
      await page.goto('/research/');
      const artwork = page.locator(`#${figure.anchor} [data-scalable-figure]`);
      await artwork.scrollIntoViewIfNeeded();
      await artwork
        .locator('[data-figure-poster] img')
        .evaluate((image: HTMLImageElement) => image.decode());
      // Element screenshots round fractional page offsets; align the box to the pixel grid.
      await artwork.evaluate((host: HTMLElement) => {
        const y = host.getBoundingClientRect().y;
        host.style.transform = `translateY(${Math.round(y) - y}px)`;
      });
      const geometry = await artwork.evaluate((host) => {
        const box = host.getBoundingClientRect();
        const style = getComputedStyle(host.querySelector('iframe')!);
        return {
          width: box.width,
          height: box.height,
          frameWidth: style.width,
          frameHeight: style.height,
          margin: style.marginLeft,
          transform: style.transform,
          background: getComputedStyle(host).getPropertyValue('--ink'),
        };
      });
      const poster = await artwork.screenshot();
      const reference = await context.newPage();
      try {
        await reference.setViewportSize({ width, height: 900 });
        await reference.route('**/__first-frame__', (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: `<body style="margin:0;background:${geometry.background}"><div id="sample" data-screen-reveal data-screen-pending style="width:${geometry.width}px;height:${geometry.height}px;overflow:hidden"><iframe src="${figure.src}" style="display:block;border:0;width:${geometry.frameWidth};height:${geometry.frameHeight};margin-left:${geometry.margin};transform:${geometry.transform};transform-origin:top left"></iframe></div>`,
          }),
        );
        await reference.goto('/__first-frame__');
        await expect(
          reference.frameLocator('iframe').locator('[data-figure-drawn]').first(),
        ).toHaveAttribute('data-figure-drawn', '');
        await waitForPicture(reference);
        const live = await reference.locator('#sample').screenshot();
        const decode = (buffer: Buffer) =>
          sharp(buffer).removeAlpha().blur(0.8).raw().toBuffer({ resolveWithObject: true });
        const [before, after] = await Promise.all([decode(poster), decode(live)]);
        expect(before.info).toEqual(after.info);
        let changed = 0;
        for (let index = 0; index < before.data.length; index += 3) {
          const delta = Math.max(
            ...[0, 1, 2].map((channel) =>
              Math.abs(before.data[index + channel] - after.data[index + channel]),
            ),
          );
          if (delta > 32) changed++;
        }
        expect(
          changed / (before.info.width * before.info.height),
          'first-frame artwork must align, beyond ordinary WebP/font rasterization differences',
        ).toBeLessThan(0.025);
      } finally {
        await reference.close();
      }
    });
  }
}
