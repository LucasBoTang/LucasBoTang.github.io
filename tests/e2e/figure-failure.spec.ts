import { expect, test } from '@playwright/test';
import { routes } from '../../src/data/navigation';
import { researchFigures } from '../../src/data/research/figures';
import { ARRIVAL_EVENT } from '../../src/lib/arrival';

test('a stalled figure releases its entrance and caption at the failure bound', async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript((arrivalEvent) => {
    document.addEventListener(
      arrivalEvent,
      (event) => {
        const trigger = event.target as HTMLElement;
        if (trigger.matches('.screen-trigger'))
          trigger.dataset.testArrivalAt = String(
            performance.now() + (event as CustomEvent<{ delay: number }>).detail.delay,
          );
      },
      true,
    );
  }, ARRIVAL_EVENT);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**${researchFigures.gpu.src}`, async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.goto(routes.research, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).not.toHaveAttribute('data-opening-pending');
    const figure = page.locator(`#${researchFigures.gpu.anchor}`);
    const screen = figure.locator('[data-screen-reveal]');
    await screen.scrollIntoViewIfNeeded();
    await expect(screen).toHaveAttribute('data-screen-pending', '');
    const trigger = screen.locator('.screen-trigger');
    await expect(trigger).toHaveAttribute('data-test-arrival-at', /\d/);
    const untilBound = await trigger.evaluate(
      (element) =>
        Math.max(0, Number((element as HTMLElement).dataset.testArrivalAt) - performance.now()) +
        5000,
    );
    await page.clock.fastForward(untilBound);
    // The bound releases the existing fade; advancing its original duration commits the picture.
    await page.clock.runFor(450);
    await expect(screen.locator('.screen-picture')).toHaveCSS('opacity', '1');
    await expect(screen).not.toHaveAttribute('data-screen-pending');
    await expect(figure.locator('figcaption')).toHaveCSS('opacity', '1');
    expect(
      await screen
        .locator('iframe')
        .evaluate((frame: HTMLIFrameElement) => frame.contentDocument?.URL === 'about:blank'),
    ).toBe(true);
  } finally {
    release();
  }
});

test('a failed figure document leaves its caption readable and releases playback', async ({
  page,
}) => {
  await page.route(`**${researchFigures.gpu.src}`, (route) => route.abort());
  await page.goto(routes.research);
  const figure = page.locator(`#${researchFigures.gpu.anchor}`);
  await figure.scrollIntoViewIfNeeded();
  await expect(figure.locator('.screen-picture')).toHaveCSS('opacity', '1');
  await expect(figure.locator('figcaption')).toHaveCSS('opacity', '1');
  await expect(figure.locator('[data-screen-reveal]')).not.toHaveAttribute('data-screen-pending');
});
