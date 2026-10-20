import { expect, test } from '@playwright/test';
import { attributeChanges, recordAttribute, recordRestores, restoredAt } from './helpers';

// The motion that keeps running after the openings: project wordmarks, page-title glitches and the
// About sign, including after a return through the back-forward cache.

test('project wordmarks are disturbed now and then on their own', async ({ page }) => {
  for (const route of ['/', '/software/']) {
    await page.goto(route);
    const wordmark = page.locator('.project-wordmark').first();
    await wordmark.scrollIntoViewIfNeeded();
    await expect(wordmark).toHaveAttribute('data-glitching', '', { timeout: 5000 });
    await expect(wordmark).not.toHaveAttribute('data-glitching', /.*/);
  }
});

test('pointing at an entry holds its wordmark still, and leaving lets it drift again', async ({
  page,
}) => {
  await page.goto('/software/');
  const entry = page.locator('[data-project-host]').first();
  await entry.scrollIntoViewIfNeeded();
  const wordmark = entry.locator('.project-wordmark');
  await wordmark.hover();
  await expect(wordmark).not.toHaveAttribute('data-glitching', /.*/);
  for (let sample = 0; sample < 30; sample++) {
    expect(await wordmark.getAttribute('data-glitching')).toBeNull();
    await page.waitForTimeout(100);
  }
  // Regression: a clicked link kept focus, which held the word as if it were still pointed at.
  await page.evaluate(() => document.addEventListener('click', (event) => event.preventDefault()));
  await entry.locator('a').last().click();
  await page.mouse.move(0, 0);
  await expect(wordmark).toHaveAttribute('data-glitching', '', { timeout: 5000 });
});

test('a unit is lit as a whole while pointed at: a project, or the contributions together', async ({
  page,
}) => {
  for (const [route, unit] of [
    ['/software/', '.software-entry'],
    ['/software/', '#contributions'],
  ]) {
    await page.goto(route);
    const lit = page.locator(`${unit}[data-lit]`).first();
    await lit.scrollIntoViewIfNeeded();
    const light = () => lit.evaluate((element) => getComputedStyle(element, '::before').opacity);
    await page.mouse.move(0, 0);
    await expect.poll(light).toBe('0');
    await lit.hover();
    await expect.poll(light).toBe('1');
  }
});

test('the Research index marks the theme being read', async ({ page }) => {
  await page.goto('/research/');
  const current = () =>
    page.locator('[data-reading-index] a[aria-current="location"]').getAttribute('href');
  const links = page.locator('[data-reading-index] a');
  await expect.poll(current).toBe(await links.first().getAttribute('href'));
  await page
    .locator('#learning-to-optimize')
    .evaluate((section) =>
      window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY - 100),
    );
  await expect.poll(current).toBe('#learning-to-optimize');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(current).toBe(await links.last().getAttribute('href'));
});

test('page titles glitch briefly after the first second', async ({ page }) => {
  await recordAttribute(page, 'data-slip');
  await page.goto('/research/');
  await expect
    .poll(async () => (await attributeChanges(page, 'data-slip')).some(({ on }) => !on), {
      timeout: 5000,
    })
    .toBe(true);
  const changes = await attributeChanges(page, 'data-slip');
  const on = changes.find((change) => change.on)!.at;
  const off = changes.find((change) => !change.on && change.at > on)!.at;
  expect(on).toBeGreaterThan(800);
  // Generous: under a full parallel run, the page itself can take a while to load.
  expect(on).toBeLessThan(4000);
  expect(off - on).toBeLessThan(800);
});

test('the About sign writes the research fields, then switches to the slogan', async ({ page }) => {
  await page.goto('/');
  const sign = page.locator('[data-decision-sign] svg');
  await sign.scrollIntoViewIfNeeded();
  await expect(sign).toHaveAttribute('data-sign-state', 'fields', { timeout: 9000 });
  await expect(sign.locator('.research-lettering')).toHaveCount(1);
  await expect(sign).toHaveAttribute('data-sign-state', 'slogan', { timeout: 9000 });
  await expect(sign.locator('.slogan-dot')).toHaveCount(2);
  for (const dot of await sign.locator('.slogan-dot').all())
    await expect(dot).toHaveAttribute('transform', /^translate\(0 0\) rotate\(0 /);
});

test('a page title glitches a moment after the page opens, rests, and pointing at it starts nothing', async ({
  page,
}) => {
  await recordAttribute(page, 'data-slip');
  await page.goto('/research/');
  const bursts = async () =>
    (await attributeChanges(page, 'data-slip')).filter(({ on }) => on).length;
  await expect.poll(bursts, { timeout: 5000 }).toBe(1);
  // The next glitch waits seven seconds at least, and a pointer does not hurry it.
  await page.locator('h1').hover();
  await page.waitForTimeout(3000);
  expect(await bursts()).toBe(1);
});

test('moving between pages, the page title rewrites itself in place', async ({ page }) => {
  await page.goto('/research/');
  await expect(page.locator('h1')).toHaveCSS('opacity', '1');
  await recordAttribute(page, 'data-title-from');
  await page.locator('nav a[href="/software/"]').click();
  await expect(page).toHaveURL(/\/software\/$/);
  // The new page starts from the last title, rewrites it, then settles on its own. Each step is
  // waited for, as the rewriting takes its own time.
  const handedOver = async (on: boolean) =>
    (await attributeChanges(page, 'data-title-from')).some((change) => change.on === on);
  await expect.poll(() => handedOver(true)).toBe(true);
  await expect.poll(() => handedOver(false), { timeout: 3000 }).toBe(true);
  await expect(page.locator('h1')).not.toHaveAttribute('data-title-from', /.*/);
  await expect(page.locator('h1 .title-signal')).toHaveText('Software');
  await expect(page.locator('h1')).toHaveAccessibleName('Software');
});

test('motion resumes after going Back through the back-forward cache', async ({ page }) => {
  // Regression: scripts that stopped on `pagehide` stayed stopped once the page was restored.
  await recordRestores(page);
  const goAwayAndBack = async () => {
    await page.goto('/about/');
    await page.goBack({ waitUntil: 'commit' });
    const restored = await expect
      .poll(() => restoredAt(page), { timeout: 3000 })
      .toBeDefined()
      .then(() => true)
      .catch(() => false);
    test.skip(!restored, 'This browser did not restore the page from the back-forward cache');
    return (await restoredAt(page))!;
  };

  await page.goto('/');
  const sign = page.locator('[data-decision-sign] svg');
  await sign.scrollIntoViewIfNeeded();
  await expect(sign).toHaveAttribute('data-sign-state', /.+/, { timeout: 5000 });
  await goAwayAndBack();
  const before = await sign.getAttribute('data-sign-state');
  await expect(sign).not.toHaveAttribute('data-sign-state', before!, { timeout: 9000 });
});

test('a click lands on an entry still arriving, and Tab shows every entry at once', async ({
  page,
}) => {
  await page.goto('/research/');
  const paper = page.locator('#h-pdlp');
  await paper.scrollIntoViewIfNeeded();
  // Clicked as it arrives, the entry keeps arriving under the pointer instead of jumping away.
  await expect.poll(() => paper.evaluate((element) => element.getAnimations().length)).toBe(1);
  await paper.getByRole('button', { name: /^BibTeX:/ }).click();
  await expect(page.locator('#h-pdlp-bibtex')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#h-pdlp-bibtex')).toBeHidden();

  await page.goto('/research/');
  await page.keyboard.press('Tab');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          [...document.querySelectorAll('[data-reveal="unit"]')].filter(
            (unit) => unit.getAnimations().length,
          ).length,
      ),
    )
    .toBe(0);
});

test('a wordmark powers on once its entry has landed, 800ms after the entry sets off', async ({
  page,
}) => {
  await page.goto('/software/');
  const entry = page.locator('.software-entry').first();
  await expect
    .poll(() => entry.evaluate((element) => element.getAnimations().length))
    .toBeGreaterThan(0);
  const gap = await entry.evaluate((element) => {
    const arrival = element.getAnimations()[0].effect!.getTiming().delay ?? 0;
    const beam = element.querySelector('.project-beam')!.getAnimations()[0];
    return (beam.effect!.getTiming().delay ?? 0) - arrival;
  });
  expect(gap).toBe(800);
});

test('a wordmark waits to power on until it has come into view', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/');
  const entry = page.locator('.work-entry').first();
  const beamState = () =>
    entry.evaluate(
      (element) => element.querySelector('.project-beam')!.getAnimations()[0]?.playState ?? 'none',
    );
  // The top of the entry comes into view, its title arriving; the wordmark, centred lower, does not.
  await page.evaluate(() => {
    const top = document.querySelector('.work-entry')!.getBoundingClientRect().top + scrollY;
    scrollTo(0, top - innerHeight + 150);
  });
  await expect
    .poll(() => entry.evaluate((element) => element.getAnimations().length), { timeout: 5000 })
    .toBeGreaterThan(0);
  await page.waitForTimeout(2500);
  expect(await beamState()).toBe('paused');
  await entry.locator('.project-wordmark').scrollIntoViewIfNeeded();
  await expect.poll(beamState, { timeout: 3000 }).not.toBe('paused');
});

test('the About sign draws its fields through a single clip that also carries the band', async ({
  page,
}) => {
  // Safari on phones does not redraw a clipped shape inside a group whose own clip changes, so the
  // fields would be lost after their first cycle: the band must ride on the fields' one clip.
  await page.goto('/');
  const sign = page.locator('.decision-sign');
  await sign.scrollIntoViewIfNeeded();
  await expect
    .poll(() => sign.evaluate((element) => element.querySelector('svg')!.dataset.signState), {
      timeout: 8000,
    })
    .toBe('writing');
  expect(await page.locator('.research-lines').getAttribute('clip-path')).toBeNull();
  const shapes = () =>
    page.evaluate(() => {
      const fields = document.querySelector('.research-lettering')!;
      const id = fields.getAttribute('clip-path')!.slice(5, -1);
      const d = document.getElementById(id)!.querySelector('path')!.getAttribute('d') ?? '';
      return d.split('M').length - 1;
    });
  await expect.poll(shapes, { timeout: 4000, intervals: [50] }).toBeGreaterThan(1);
});
