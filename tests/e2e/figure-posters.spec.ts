import { expect, test, type Page } from '@playwright/test';
import { researchFigures } from '../../src/data/research/figures';
import { ARRIVAL_EVENT } from '../../src/lib/arrival';

test.use({ reducedMotion: 'reduce' });

function recordFigureArrival(page: Page) {
  return page.addInitScript((eventName) => {
    document.addEventListener(
      eventName,
      (event) => {
        (event.target as Element)
          .closest('[data-screen-reveal]')
          ?.setAttribute('data-test-arrived', '');
      },
      true,
    );
  }, ARRIVAL_EVENT);
}

for (const [kind, figure] of Object.entries(researchFigures)) {
  test(`${kind} keeps a static first frame while its live document is delayed`, async ({
    page,
  }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**${figure.src}`, async (route) => {
      await held;
      await route.continue();
    });
    try {
      await page.goto('/research/');
      const artwork = page.locator(`#${figure.anchor} [data-scalable-figure]`);
      await artwork.scrollIntoViewIfNeeded();
      const poster = artwork.locator('[data-figure-poster] img');
      await expect(poster).toBeVisible();
      await expect
        .poll(() =>
          poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);
      await expect(artwork).not.toHaveAttribute('data-figure-live', '');
      const before = await artwork.boundingBox();
      release();
      await expect(artwork).toHaveAttribute('data-figure-live', '', { timeout: 15000 });
      await expect(artwork.locator('iframe').first()).toHaveCSS('opacity', '1');
      await expect(artwork.locator('[data-figure-poster]')).toBeHidden();
      expect(await artwork.boundingBox()).toEqual(before);
    } finally {
      release();
    }
  });
}

test('a failed WebGL initialization keeps the static frame visible', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = new Proxy(getContext, {
      apply(target, receiver, args) {
        if (String(args[0]).includes('webgl')) return null;
        return Reflect.apply(target, receiver, args);
      },
    });
  });
  await page.goto('/research/');
  const artwork = page.locator('#bo-l2o-study [data-scalable-figure]');
  await artwork.scrollIntoViewIfNeeded();
  await expect(artwork.frameLocator('iframe').locator('[data-l2o-surface]')).toHaveAttribute(
    'data-figure-drawn',
    'fallback',
  );
  await expect(artwork.locator('[data-figure-poster] img')).toBeVisible();
  await expect(artwork).not.toHaveAttribute('data-figure-live', '');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  for (const width of [375, 721, 1280])
    test(`research contains complete static figures without fitting at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/research/');
      for (const figure of Object.values(researchFigures)) {
        const artwork = page.locator(`#${figure.anchor} [data-scalable-figure]`);
        await artwork.scrollIntoViewIfNeeded();
        await expect(artwork.locator('[data-figure-poster] img')).toBeVisible();
        await expect(artwork.locator('[data-figure-poster] img')).toHaveCSS(
          'object-fit',
          'contain',
        );
      }
    });
});

for (const width of [
  315, 338, 339, 368, 369, 375, 380, 386, 387, 390, 414, 426, 427, 430, 431, 445, 468, 469, 528,
  529, 541,
]) {
  test(`static and live frames share their box at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/research/');
    for (const figure of Object.values(researchFigures)) {
      const artwork = page.locator(`#${figure.anchor} [data-scalable-figure]`);
      await artwork.scrollIntoViewIfNeeded();
      const poster = artwork.locator('[data-figure-poster]');
      const live = artwork.locator('iframe').first();
      const posterBox = await poster.boundingBox();
      const liveBox = await live.boundingBox();
      expect(posterBox).toEqual(liveBox);
      const image = poster.locator('img');
      await expect(image).toHaveCSS('object-fit', 'cover');
      await image.evaluate((element: HTMLImageElement) => element.decode());
      const geometry = await image.evaluate((element: HTMLImageElement) => ({
        scale: Math.max(
          element.clientWidth / (element.naturalWidth / 2),
          element.clientHeight / (element.naturalHeight / 2),
        ),
        crop: element.naturalWidth / 2 - element.clientWidth,
      }));
      expect(
        Math.abs(geometry.scale - 1),
        'preserve the captured pixel proportions without stretching',
      ).toBeLessThan(0.002);
      expect(geometry.crop, 'trim at most one sampling interval').toBeLessThan(2.01);
      expect(geometry.crop).toBeGreaterThanOrEqual(-1);
      await expect(artwork).toHaveAttribute('data-figure-live', '', { timeout: 15000 });
    }
  });
}

test('a stalled poster image cannot keep the figure caption hidden', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await recordFigureArrival(page);
  let requested = false;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/gpu-(wide|compact|phone-[0-9]+)[^/]*\.webp/, async (route) => {
    requested = true;
    await held;
    await route.abort();
  });
  await page.route(`**${researchFigures.gpu.src}`, (route) => route.abort());
  try {
    await page.goto('/research/');
    const figure = page.locator(`#${researchFigures.gpu.anchor}`);
    await figure.scrollIntoViewIfNeeded();
    await expect.poll(() => requested).toBe(true);
    await expect(figure.locator('[data-screen-reveal]')).toHaveAttribute('data-test-arrived', '');
    await expect(figure.locator('figcaption')).toHaveCSS('opacity', '1', { timeout: 7500 });
    await expect(figure.locator('[data-screen-reveal]')).not.toHaveAttribute(
      'data-screen-pending',
      '',
    );
  } finally {
    release();
  }
});

test('a ready live figure does not wait for a stalled poster download', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await recordFigureArrival(page);
  let release!: () => void;
  let requested = false;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/gpu-(wide|compact|phone-[0-9]+)[^/]*\.webp/, async (route) => {
    requested = true;
    await held;
    await route.abort();
  });
  try {
    await page.goto('/research/');
    const figure = page.locator(`#${researchFigures.gpu.anchor}`);
    await figure.scrollIntoViewIfNeeded();
    await expect.poll(() => requested).toBe(true);
    await expect(figure.locator('[data-screen-reveal]')).toHaveAttribute('data-test-arrived', '');
    await expect(figure.locator('[data-scalable-figure]')).toHaveAttribute('data-figure-live', '');
    await expect(figure.locator('figcaption')).toHaveCSS('opacity', '1', { timeout: 2500 });
    await expect(figure.locator('[data-figure-poster]')).toBeHidden();
  } finally {
    release();
  }
});

test('the mobile live clock starts only after the static first frame has faded', async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    if (!window.frameElement) return;
    document.addEventListener(
      'l2o:tick',
      (event) => {
        const detail = (event as CustomEvent<{ t: number }>).detail;
        if (detail.t <= 0) return;
        const host = window.frameElement?.closest('[data-scalable-figure]');
        if (host?.hasAttribute('data-figure-poster-pending'))
          window.parent.document.documentElement.setAttribute('data-test-poster-advanced', '');
        window.parent.document.documentElement.setAttribute('data-test-live-playing', '');
      },
      true,
    );
  });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**${researchFigures.l2o.src}`, async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.goto('/research/');
    const artwork = page.locator('#bo-l2o-study [data-scalable-figure]');
    await artwork.scrollIntoViewIfNeeded();
    await artwork
      .locator('[data-figure-poster] img')
      .evaluate((image: HTMLImageElement) => image.decode());
    await expect(artwork).toHaveAttribute('data-figure-poster-pending', '');
    await page.setViewportSize({ width: 431, height: 900 });
    await artwork
      .locator('[data-figure-poster] img')
      .evaluate((image: HTMLImageElement) => image.decode());
    await expect(artwork).not.toHaveAttribute('data-figure-live', '');
    const before = await artwork.boundingBox();
    release();
    await expect(artwork).toHaveAttribute('data-figure-live', '', { timeout: 15000 });
    await expect(page.locator('html')).toHaveAttribute('data-test-live-playing', '');
    await expect(page.locator('html')).not.toHaveAttribute('data-test-poster-advanced', '');
    expect(await artwork.boundingBox()).toEqual(before);
    await page.setViewportSize({ width: 800, height: 430 });
    await expect(artwork).toHaveAttribute('data-figure-live', '');
    await expect(artwork.locator('[data-figure-poster]')).toBeHidden();
  } finally {
    release();
  }
});

test('a failed live photograph keeps the complete static first frame', async ({ page }) => {
  await page.route('**/images/research/decision-costs.webp', (route) => route.abort());
  await page.goto('/research/');
  const artwork = page.locator('#bo-dfl-study [data-scalable-figure]');
  await artwork.scrollIntoViewIfNeeded();
  const inner = artwork.frameLocator('iframe');
  await expect(inner.locator('[data-figure-drawn]')).toHaveAttribute('data-figure-drawn', '');
  await expect
    .poll(() =>
      inner
        .locator('.dfl-photo img')
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 0),
    )
    .toBe(true);
  await artwork
    .locator('[data-figure-poster] img')
    .evaluate((image: HTMLImageElement) => image.decode());
  // Let the ordinary two paint frames and the 120ms handover finish before checking retention.
  await page.waitForTimeout(300);
  await expect(artwork).not.toHaveAttribute('data-figure-live', '');
  await expect(artwork.locator('[data-figure-poster]')).toBeVisible();
  await expect(page.locator('#bo-dfl-study figcaption')).toHaveCSS('opacity', '1');
});

test('a hidden poster stops downloading new widths after live playback takes over', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  const requested: string[] = [];
  page.on('request', (request) => {
    if (/\/gpu-(wide|phone-\d+)[^/]*\.webp/.test(request.url())) requested.push(request.url());
  });
  await page.goto('/research/');
  const artwork = page.locator('#bo-gpu-study [data-scalable-figure]');
  await artwork.scrollIntoViewIfNeeded();
  await expect(artwork).toHaveAttribute('data-figure-live', '');
  requested.length = 0;
  for (const width of [376, 378, 380, 390, 400]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  }
  expect(requested, 'hidden first frames should not compete with the live animation').toEqual([]);
  await expect(artwork.locator('[data-figure-poster]')).toBeHidden();
});

test('context loss after handover restores a responsive first frame and stops surface drawing', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.addInitScript(() => {
    if (!window.frameElement) return;
    document.addEventListener(
      'l2o:tick',
      (event) => {
        const html = document.documentElement;
        if ((event as CustomEvent<{ t: number }>).detail.t > 0)
          html.setAttribute('data-test-played', '');
        html.dataset.testDraws = String(Number(html.dataset.testDraws ?? 0) + 1);
      },
      true,
    );
  });
  await page.goto('/research/');
  const artwork = page.locator('#bo-l2o-study [data-scalable-figure]');
  await artwork.scrollIntoViewIfNeeded();
  await expect(artwork).toHaveAttribute('data-figure-live', '', { timeout: 15000 });
  const inner = artwork.frameLocator('iframe');
  await expect(inner.locator('html')).toHaveAttribute('data-test-played', '');
  const firstSource = await artwork
    .locator('[data-figure-poster] img')
    .evaluate((image: HTMLImageElement) => image.currentSrc);
  await page.setViewportSize({ width: 430, height: 900 });
  await inner.locator('.surface-gl').evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl')!;
    gl.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(inner.locator('[data-l2o-surface]')).toHaveAttribute(
    'data-figure-drawn',
    'fallback',
  );
  await expect(artwork).not.toHaveAttribute('data-figure-live', '');
  const image = artwork.locator('[data-figure-poster] img');
  await expect(image).toBeVisible();
  await image.evaluate((element: HTMLImageElement) => element.decode());
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.currentSrc))
    .not.toBe(firstSource);
  const restoredSource = await image.evaluate((element: HTMLImageElement) => element.currentSrc);
  const draws = await inner.locator('html').getAttribute('data-test-draws');
  await page.setViewportSize({ width: 445, height: 900 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await image.evaluate((element: HTMLImageElement) => element.decode());
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.currentSrc))
    .not.toBe(restoredSource);
  expect(await inner.locator('html').getAttribute('data-test-draws')).toBe(draws);
});
