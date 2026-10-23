import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { frameQueue, installGlobals, mediaQuery } from '../helpers/browser.mjs';
import { registerTypeScriptImports } from '../helpers/typescript-imports.mjs';

const sources = [
  { src: '/figures/a/', width: 700, height: 500 },
  {
    src: '/figures/b/',
    width: 600,
    height: 540,
    compactAt: 420,
    compact: { width: 330, height: 632 },
  },
];
let instance = 0;

/** A page whose opening keeps it dark, with the module loaded fresh against its globals. */
async function page(t, { innerWidth = 1280, markup = '', stored = {} } = {}) {
  const { document, Event } = parseHTML(`<html data-opening-pending><body>${markup}</body></html>`);
  const frames = frameQueue();
  installGlobals(t, {
    document,
    window: { setTimeout, clearTimeout, requestAnimationFrame: frames.request },
    innerWidth,
    requestAnimationFrame: frames.request,
    matchMedia: () => mediaQuery(true),
    navigator: {},
    localStorage: {
      getItem: (key) => stored[key] ?? null,
      setItem: (key, value) => (stored[key] = value),
    },
  });
  const hooks = registerTypeScriptImports();
  try {
    const module = await import(
      `../../src/components/catalogue/FigureWarmup/figure-warmup.ts?test=${++instance}`
    );
    return { document, frames, Event, warmFigures: module.warmFigures };
  } finally {
    hooks.deregister();
  }
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('draws every figure in one unseen slot at the size its embed gives it', async (t) => {
  const { document, frames, Event, warmFigures } = await page(t);
  const done = warmFigures(sources, [], 5000);
  const slot = document.querySelector('[data-figure-warmup]');
  assert.ok(slot, 'a slot is added to the body');
  assert.equal(slot.getAttribute('aria-hidden'), 'true');
  const iframes = [...slot.querySelectorAll('iframe')];
  assert.deepEqual(
    iframes.map((frame) => [frame.getAttribute('src'), frame.width, frame.height]),
    [
      ['/figures/a/', '700', '500'],
      ['/figures/b/', '600', '540'],
    ],
  );
  let settled = false;
  void done.then(() => (settled = true));
  for (const frame of iframes) frame.dispatchEvent(new Event('load'));
  await flush();
  for (let i = 0; i < 24; i++) {
    frames.flush(16 * i);
    await flush();
  }
  await flush();
  assert.ok(settled, 'settles once every figure has drawn its frames');
  assert.equal(document.querySelector('[data-figure-warmup]'), null, 'the slot is removed');
});

test('uses the compact size on a narrow screen', async (t) => {
  const { document, warmFigures } = await page(t, { innerWidth: 390 });
  const done = warmFigures(sources, [], 20);
  const [, compact] = document.querySelectorAll('iframe');
  assert.equal(compact.width, '330');
  assert.equal(compact.height, '632');
  await done;
});

test('gives up, and removes the slot, when a figure never loads', async (t) => {
  const { document, warmFigures } = await page(t);
  await warmFigures(sources, [], 20);
  assert.equal(document.querySelector('[data-figure-warmup]'), null);
});

test('settles at once with nothing to draw', async (t) => {
  const { document, warmFigures } = await page(t);
  await warmFigures([]);
  assert.equal(document.querySelector('[data-figure-warmup]'), null);
});

test('plays each declared filter sequence in the slot, each once', async (t) => {
  const { document, warmFigures } = await page(t);
  const blur = ['blur(2px)', 'blur(0px)'];
  const done = warmFigures([], [blur, ['none', 'url("#pull")'], blur], 20);
  const boxes = [...document.querySelectorAll('[data-figure-warmup] [data-warm-filter]')];
  assert.deepEqual(
    boxes.map((box) => box.getAttribute('data-warm-filter')),
    ['blur(2px) / blur(0px)', 'none / url("#pull")', 'blur(2px) / blur(0px)'],
  );
  await done;
});

test('the page component warms its sources and the filters the page declares', async (t) => {
  const markup =
    `<div data-figure-warmup-sources='${JSON.stringify(sources)}' data-figure-warmup-version="v2" hidden></div>` +
    `<a data-warm-filters='[["blur(2px)","blur(0px)"]]'></a><a data-warm-filters='[["blur(2px)","blur(0px)"],["none","url(#x)"]]'></a>`;
  const stored = {};
  const { document, frames, Event } = await page(t, { markup, stored });
  assert.equal(document.querySelectorAll('[data-figure-warmup] iframe').length, 2);
  assert.equal(document.querySelectorAll('[data-figure-warmup] [data-warm-filter]').length, 2);
  for (const frame of document.querySelectorAll('iframe')) frame.dispatchEvent(new Event('load'));
  for (let i = 0; i < 25; i++) {
    await flush();
    frames.flush(16 * i);
  }
  await flush();
  assert.equal(document.querySelector('[data-figure-warmup]'), null);
  assert.deepEqual(JSON.parse(stored['figure-warmup']), ['/figures/a/#v2', '/figures/b/#v2']);

  const again = await page(t, { markup, stored });
  assert.equal(again.document.querySelector('[data-figure-warmup]'), null, 'a later visit skips');
});

test('a figure not yet drawn through is drawn ahead, with the rest', async (t) => {
  const markup = `<div data-figure-warmup-sources='${JSON.stringify(sources)}' data-figure-warmup-version="v2" hidden></div>`;
  const stored = { 'figure-warmup': JSON.stringify(['/figures/a/#v2']) };
  const { document } = await page(t, { markup, stored });
  assert.equal(document.querySelectorAll('[data-figure-warmup] iframe').length, 2);
});

test('figures drawn from an earlier version of their source are drawn ahead again', async (t) => {
  const markup = `<div data-figure-warmup-sources='${JSON.stringify(sources)}' data-figure-warmup-version="v2" hidden></div>`;
  const stored = { 'figure-warmup': JSON.stringify(['/figures/a/#v1', '/figures/b/#v1']) };
  const { document } = await page(t, { markup, stored });
  assert.equal(document.querySelectorAll('[data-figure-warmup] iframe').length, 2);
});
