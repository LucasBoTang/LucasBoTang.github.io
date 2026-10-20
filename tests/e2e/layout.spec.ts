import { expect, test } from '@playwright/test';
import { firstBaseline, gridColumns, textExtent, textLeft } from './helpers';

// Every page hangs on one grid: text starts on column 1 or column 6, and every link reads in one
// label style. Measured at 1280px with motion reduced, so nothing is mid-flight.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
});

const near = (actual: number, expected: number, tolerance = 1) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

test('the header sets the name on column 1 and the pages flush right', async ({ page }) => {
  await page.goto('/research/');
  const cols = await gridColumns(page);
  near(await textLeft(page, '.site-header-name'), cols[0].left, 2);
  const links = page.locator('.site-header nav a');
  await expect(links).toHaveCount(3);
  await expect(page.locator('.site-header a[download]')).toHaveCount(0);
  const last = await textExtent(page, '.site-header nav a:last-child');
  near(last[0].right, cols[11].right);
  const size = await links.first().evaluate((link) => getComputedStyle(link).fontSize);
  expect(size).toBe('16px');
});

test('the CV is offered on the About page', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('#cv-heading')).toHaveText('CV');
  await expect(page.locator('main a[download]')).toHaveText(/Download/);
});

test('every link and button shares one label style', async ({ page }) => {
  await page.goto('/');
  const styles = await page.evaluate(() =>
    ['.arrow-link', '.resource-links a', '.contact-links a', '.contact-links--footer a'].map(
      (selector) => {
        const style = getComputedStyle(document.querySelector(selector)!);
        return [
          style.fontFamily,
          style.fontSize,
          style.lineHeight,
          style.letterSpacing,
          style.textTransform,
        ].join(' | ');
      },
    ),
  );
  expect(new Set(styles).size).toBe(1);
  expect(styles[0]).toMatch(/\| 12px \| 16px \| normal \| none$/);
});

test('the footer mirrors the header: name left, contact links flush right', async ({ page }) => {
  await page.goto('/research/');
  const cols = await gridColumns(page);
  near(await textLeft(page, '.site-footer-name'), cols[0].left, 2);
  const links = await textExtent(page, '.contact-links--footer a');
  near(links.at(-1)!.right, cols[11].right);
  near(
    await firstBaseline(page, '.contact-links--footer a [data-contact-label]'),
    await firstBaseline(page, '.site-footer-identity p'),
    1,
  );
});

test('the hero name keeps its own size and starts on column 1', async ({ page }) => {
  await page.goto('/');
  const cols = await gridColumns(page);
  const size = await page.locator('#hero-name').evaluate((name) => getComputedStyle(name).fontSize);
  expect(size).toBe('72px');
  // Bodoni's B sits a little inside its advance; 3px allows for that side bearing.
  near(await textLeft(page, '#hero-name .name-base'), cols[0].left, 3);
});

test('the hero copy starts on column 6', async ({ page }) => {
  await page.goto('/');
  const cols = await gridColumns(page);
  near(await textLeft(page, '.affiliation p'), cols[5].left);
  near(await textLeft(page, '.hero-intro .intro-copy'), cols[5].left);
});

test('the portrait sits in columns 2 to 4', async ({ page }) => {
  await page.goto('/');
  const cols = await gridColumns(page);
  const portrait = await page.locator('.portrait-block').boundingBox();
  near(portrait!.x, cols[1].left);
  near(portrait!.width, cols[3].right - cols[1].left);
});

test('the hero name stays left of column 6 at 900px', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/');
  const cols = await gridColumns(page);
  const name = await page.locator('#hero-name').boundingBox();
  expect(name!.x + name!.width).toBeLessThan(cols[5].left);
});

test('selected work centres each wordmark in its column and starts the text on column 6', async ({
  page,
}) => {
  await page.goto('/');
  const cols = await gridColumns(page);
  const sideCentre = (cols[0].left + cols[4].right) / 2;
  const entries = await page.locator('.work-entry').count();
  for (let index = 0; index < entries; index++) {
    const entry = page.locator('.work-entry').nth(index);
    const face = await entry.locator('.project-face').boundingBox();
    const details = await entry.locator('.work-details').boundingBox();
    near(face!.x + face!.width / 2, sideCentre, 2);
    near(face!.y + face!.height / 2, details!.y + details!.height / 2, 2);
    near(await textLeft(page, '.work-title-link', index), cols[5].left);
  }
});

test('the work note is in natural case', async ({ page }) => {
  await page.goto('/');
  const transform = await page
    .locator('.work-note')
    .first()
    .evaluate((note) => getComputedStyle(note).textTransform);
  expect(transform).toBe('none');
});

test('about sets the copy from column 1 and the sign in columns 9 to 11', async ({ page }) => {
  await page.goto('/');
  const cols = await gridColumns(page);
  const sign = await page.locator('.about-fields').boundingBox();
  near(sign!.x, cols[8].left);
  near(sign!.x + sign!.width, cols[10].right);
  near(await textLeft(page, '.about-copy p'), cols[0].left);
});

test('the about sign hangs a tab below its lettering', async ({ page }) => {
  await page.goto('/');
  const viewBox = await page.locator('.decision-sign svg').getAttribute('viewBox');
  expect(viewBox).toBe('0 0 300 134');
});

test('every page title is Display with its lead right under it', async ({ page }) => {
  for (const route of ['/about/', '/research/', '/software/', '/missing-page/']) {
    await page.goto(route);
    const cols = await gridColumns(page);
    const size = await page.locator('h1').evaluate((title) => getComputedStyle(title).fontSize);
    expect(size, route).toBe('96px');
    near(await textLeft(page, '.page-header h1'), cols[0].left, 3);
    near(await textLeft(page, '.page-header p'), cols[0].left);
  }
});

test('publications hang their year in column 5', async ({ page }) => {
  await page.goto('/research/');
  const cols = await gridColumns(page);
  for (let index = 0; index < 3; index++) {
    near(await textLeft(page, '.publication-year', index), cols[4].left);
    near(await textLeft(page, '.publication-title-link', index), cols[5].left);
    near(
      await firstBaseline(page, '.publication-year', index),
      await firstBaseline(page, '.publication-title-link', index),
      2,
    );
  }
});

test('the index fits columns 1 to 4 on one line each, at the navigation size', async ({ page }) => {
  await page.goto('/research/');
  const cols = await gridColumns(page);
  const size = await page
    .locator('.research-index nav a')
    .first()
    .evaluate((link) => getComputedStyle(link).fontSize);
  expect(size).toBe('16px');
  for (const { lines, right } of await textExtent(page, '.research-index nav a')) {
    expect(lines).toBe(1);
    expect(right).toBeLessThanOrEqual(cols[3].right);
  }
});

test('research headings hang with the years in column 5, on one line', async ({ page }) => {
  await page.goto('/research/');
  const cols = await gridColumns(page);
  near(await textLeft(page, '.research-section h2'), cols[4].left, 3);
  near(await textLeft(page, '.research-question'), cols[4].left);
  for (const { lines } of await textExtent(page, '.research-section h2')) expect(lines).toBe(1);
});

test('no entry text crosses column 11 at 800px', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/research/');
  const cols = await gridColumns(page);
  const selectors =
    '.publication-body h3, .publication-year, .research-section h2, .research-introduction';
  for (const { right } of await textExtent(page, selectors))
    expect(right).toBeLessThanOrEqual(cols[10].right + 1);
});

test('a preprint keeps clear of its title at tablet widths', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto('/research/');
  const year = await page.locator('.publication-year').first().boundingBox();
  const title = await page.locator('.publication-title-link').first().boundingBox();
  const [text] = await textExtent(page, '.publication-year');
  const above = year!.y + year!.height <= title!.y;
  const beside = text.right + 8 <= title!.x;
  expect(above || beside).toBe(true);
});

test('the hero copy keeps column 12 empty', async ({ page }) => {
  for (const width of [1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const cols = await gridColumns(page);
    for (const { right } of await textExtent(page, '.hero-intro .intro-copy, .affiliation a'))
      expect(right).toBeLessThanOrEqual(cols[10].right + 1);
  }
});

test('the BibTeX entry is set in the site mono', async ({ page }) => {
  await page.goto('/research/');
  await page.locator('.bibtex-open').first().click();
  const family = await page
    .locator('.bibtex-dialog[open] code')
    .evaluate((code) => getComputedStyle(code).fontFamily);
  expect(family).toContain('Geist Mono');
});

test('BibTeX keeps its spelling', async ({ page }) => {
  await page.goto('/research/');
  const open = page.locator('.bibtex-open').first();
  expect(await open.evaluate((button) => getComputedStyle(button).textTransform)).toBe('none');
  await open.click();
  const name = page.locator('.bibtex-dialog[open] .bibtex-name');
  await expect(name).toHaveText('BibTeX');
  expect(await name.evaluate((label) => getComputedStyle(label).textTransform)).toBe('none');
});

test('headings are set at weight 400, wordmarks aside', async ({ page }) => {
  for (const route of ['/', '/about/', '/research/', '/software/']) {
    await page.goto(route);
    const weights = await page
      .locator('h1, h2, h3:not(.project-wordmark), strong')
      .evaluateAll((all) => [
        ...new Set(all.map((element) => getComputedStyle(element).fontWeight)),
      ]);
    expect(weights, route).toEqual(['400']);
  }
});

test('software hangs names on column 1 and text on column 6', async ({ page }) => {
  await page.goto('/software/');
  const cols = await gridColumns(page);
  const entries = await page.locator('.software-entry').count();
  for (let index = 0; index < entries; index++) {
    near(await textLeft(page, '.entry-identity', index), cols[0].left, 3);
    near(await textLeft(page, '.entry-description', index), cols[5].left);
  }
});

test('roles are not uppercased', async ({ page }) => {
  await page.goto('/software/');
  const transforms = await page
    .locator('.entry-role')
    .evaluateAll((all) => [...new Set(all.map((role) => getComputedStyle(role).textTransform))]);
  expect(transforms).toEqual(['none']);
});

test('about prose starts on column 6', async ({ page }) => {
  await page.goto('/about/');
  const cols = await gridColumns(page);
  const sections = await page.locator('.about-prose').count();
  for (let index = 0; index < sections; index++) {
    near(await textLeft(page, '.about-prose', index), cols[5].left);
    near(await textLeft(page, '.about-section .section-label', index), cols[0].left);
  }
});

test('the ways on from Selected work sit flush right', async ({ page }) => {
  await page.goto('/');
  const cols = await gridColumns(page);
  const last = await page.locator('.work-navigation .arrow-link').last().boundingBox();
  near(last!.x + last!.width, cols[11].right);
});

test('contributions read as one list, parted by space alone', async ({ page }) => {
  await page.goto('/software/');
  const borders = await page
    .locator('.software-entry--compact')
    .evaluateAll((all) => [...new Set(all.map((entry) => getComputedStyle(entry).borderTopWidth))]);
  expect(borders).toEqual(['0px']);
});

test('the theme being read is cut out of a blue tag', async ({ page }) => {
  await page.goto('/research/');
  const current = page.locator('.research-index nav a[aria-current="location"]');
  await expect(current).toHaveCount(1);
  const look = await current.evaluate((link) => {
    const plate = getComputedStyle(link, '::before');
    return {
      text: getComputedStyle(link).color,
      plate: plate.backgroundColor,
      shape: plate.clipPath,
    };
  });
  expect(look.text).toBe('rgb(16, 17, 19)');
  expect(look.plate).toBe('rgb(110, 141, 184)');
  expect(look.shape).toMatch(/^polygon/);
});

test('the about sign sits level with the middle of the two paragraphs', async ({ page }) => {
  await page.goto('/');
  const sign = await page.locator('.about-fields').boundingBox();
  const first = await page.locator('.about-copy p').first().boundingBox();
  const last = await page.locator('.about-copy p').last().boundingBox();
  near(sign!.y + sign!.height / 2, (first!.y + last!.y + last!.height) / 2, 2);
});

test.describe('on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
  });

  test('the Selected work wordmarks stay centred, as on a wide screen', async ({ page }) => {
    await page.goto('/');
    const entries = await page.locator('.work-entry').count();
    for (let index = 0; index < entries; index++) {
      const entry = page.locator('.work-entry').nth(index);
      const face = await entry.locator('.project-face').boundingBox();
      const column = await entry.locator('.work-details').boundingBox();
      near(face!.x + face!.width / 2, column!.x + column!.width / 2, 2);
    }
  });

  test('labels that can wrap get room between their lines', async ({ page }) => {
    for (const [route, selector] of [
      ['/', '.work-note'],
      ['/research/', '.publication-venue'],
    ]) {
      await page.goto(route);
      const leading = await page
        .locator(selector)
        .first()
        .evaluate((label) => getComputedStyle(label).lineHeight);
      expect(leading, route).toBe('20px');
    }
  });

  test('the ways on from Selected work stay together', async ({ page }) => {
    await page.goto('/');
    // One link's height between the two lines of text, and no more: an arrow link is 46px tall
    // (its 30px arrow and a step of padding above and below), more than a fingertip's 44px.
    const tops = await page
      .locator('.work-navigation .arrow-link .link-label')
      .evaluateAll((all) => all.map((label) => label.getBoundingClientRect().top));
    expect(tops[1] - tops[0]).toBeLessThanOrEqual(48);
  });

  test('the about sign runs the width of the text', async ({ page }) => {
    await page.goto('/');
    const sign = await page.locator('.about-fields').boundingBox();
    const copy = await page.locator('.about-copy').boundingBox();
    near(sign!.x, copy!.x);
    near(sign!.width, copy!.width);
  });

  test('the footer links start on the text edge', async ({ page }) => {
    await page.goto('/');
    const name = await page.locator('.site-footer-name').boundingBox();
    const first = await page.locator('.contact-links--footer a').first().boundingBox();
    near(first!.x, name!.x);
  });

  test('the hero name starts on the text edge at every phone width', async ({ page }) => {
    for (const width of [320, 375, 414]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      near(
        await textLeft(page, '#hero-name .name-base'),
        await textLeft(page, '.affiliation p'),
        3,
      );
    }
  });

  test('the footer links sit in two even rows', async ({ page }) => {
    await page.goto('/');
    const tops = await page
      .locator('.contact-links--footer a')
      .evaluateAll((all) => all.map((link) => Math.round(link.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(2);
    expect(tops.filter((top) => top === tops[0]).length).toBe(2);
  });
});

test.describe('dividers', () => {
  // Two kinds only: a section rule, full width, opens each section; an item rule, quieter, parts
  // the entries inside one, starting on the line the text starts on.
  const quieter = (page: import('@playwright/test').Page) =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--rule-item').trim(),
    );

  test('entries on Home and Software are parted by item rules, not section rules', async ({
    page,
  }) => {
    for (const [route, selector] of [
      ['/', '.work-entry + .work-entry'],
      ['/software/', '.software-entry:not(.software-entry--compact) + .software-entry'],
    ]) {
      await page.goto(route);
      const look = await page
        .locator(selector)
        .first()
        .evaluate((entry) => {
          const style = getComputedStyle(entry);
          return { border: style.borderTopWidth, image: style.backgroundImage };
        });
      expect(look.border, route).toBe('0px');
      expect(look.image, route).toContain('linear-gradient');
    }
  });

  test('publications are parted by the quieter item rule', async ({ page }) => {
    await page.goto('/research/');
    const color = await page
      .locator('.publication')
      .first()
      .evaluate((item) => getComputedStyle(item).borderTopColor);
    const hex = await quieter(page);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    expect(color).toBe(`rgb(${r}, ${g}, ${b})`);
  });

  test('the ways on from Selected work stand on space alone', async ({ page }) => {
    await page.goto('/');
    const border = await page
      .locator('.work-navigation')
      .evaluate((links) => getComputedStyle(links).borderTopWidth);
    expect(border).toBe('0px');
  });
});

test.describe('measure, spacing, strokes and targets', () => {
  // Running text takes its measure from the columns it spans, six of them (about 66 characters),
  // so its right edge always lands on a column line. Home's About copy keeps seven, by choice.
  test('running text spans six columns and ends on a column line', async ({ page }) => {
    const checks: [string, string, number][] = [
      ['/', '.hero-intro', 10],
      ['/', '.work-description', 10],
      ['/', '.about-copy', 6],
      ['/research/', '.page-header p', 5],
      ['/research/', '.research-introduction', 9],
      ['/software/', '.entry-description', 10],
      ['/about/', '.about-prose', 10],
    ];
    for (const [route, selector, last] of checks) {
      await page.goto(route);
      const cols = await gridColumns(page);
      const box = await page.locator(selector).first().boundingBox();
      near(box!.x + box!.width, cols[last].right, 1);
    }
  });

  test('sections stand 160px apart on every page', async ({ page }) => {
    for (const [route, selector] of [
      ['/software/', '.software-group'],
      ['/about/', '.about-section'],
      ['/research/', '.research-section'],
    ]) {
      await page.goto(route);
      const gaps = await page.locator(selector).evaluateAll((all) =>
        all.slice(1).map((section, i) => {
          const before = all[i].getBoundingClientRect().bottom;
          return Math.round(section.getBoundingClientRect().top - before);
        }),
      );
      for (const gap of gaps) expect(gap, route).toBe(160);
    }
  });

  test('line icons draw one pixel strokes at every size', async ({ page }) => {
    await page.goto('/research/');
    await page.locator('.bibtex-open').first().click();
    const strokes = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '.contact-links svg :is(path, rect, circle), .bibtex-icon :is(path, rect), .arrow-link-symbol path',
        ),
      ]
        .filter((shape) => getComputedStyle(shape).stroke !== 'none')
        .map((shape) => {
          const style = getComputedStyle(shape);
          return `${style.vectorEffect} ${style.strokeWidth}`;
        }),
    );
    expect(strokes.length).toBeGreaterThan(0);
    expect([...new Set(strokes)]).toEqual(['non-scaling-stroke 1px']);
  });
});

test.describe('on a touch phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 800 } });

  test('the footer contact links are big enough to tap', async ({ page }) => {
    await page.goto('/');
    const heights = await page
      .locator('.contact-links--footer a')
      .evaluateAll((all) => all.map((link) => link.getBoundingClientRect().height));
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(32);
  });
});

test('text is set in Geist and labels in Geist Mono, beside the Bodoni names', async ({ page }) => {
  await page.goto('/');
  const families = await page.evaluate(() =>
    ['.hero-intro', '.section-label', '#hero-name'].map(
      (selector) => getComputedStyle(document.querySelector(selector)!).fontFamily.split(',')[0],
    ),
  );
  expect(families).toEqual(['"Geist Variable"', '"Geist Mono Variable"', '"Bodoni Moda Variable"']);
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return ['16px "Geist Variable"', '12px "Geist Mono Variable"'].map((font) =>
      document.fonts.check(font),
    );
  });
  expect(loaded).toEqual([true, true]);
});
