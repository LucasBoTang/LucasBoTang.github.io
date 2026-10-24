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

/** A page whose opening has lifted, with the module loaded fresh against its globals. */
async function page(t, { innerWidth = 1280, markup = '', stored = {} } = {}) {
  const { document, Event } = parseHTML(`<html><head></head><body>${markup}</body></html>`);
  const frames = frameQueue();
  installGlobals(t, {
    document,
    window: { setTimeout, clearTimeout, requestAnimationFrame: frames.request },
    innerWidth,
    requestAnimationFrame: frames.request,
    cancelAnimationFrame: frames.cancel,
    matchMedia: () => mediaQuery(true),
    navigator: {},
    addEventListener: () => {},
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
    const { warmFigures } =
      await import('../../src/components/catalogue/FigureWarmup/warmup-renderer.ts');
    return { document, frames, Event, ...module, warmFigures };
  } finally {
    hooks.deregister();
  }
}
function loadFigure(frame, Event, drawn = true) {
  const { document } = parseHTML(
    `<html><body><div data-figure-drawn="${drawn ? '' : 'pending'}"></div></body></html>`,
  );
  Object.defineProperty(document, 'images', { value: [] });
  Object.defineProperty(frame, 'contentDocument', { configurable: true, value: document });
  frame.dispatchEvent(new Event('load'));
  return document;
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
  for (const frame of iframes) loadFigure(frame, Event);
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

/** Loads whatever the warm-up slot holds and gives it its frames, until no slot is left. */
async function drawEach(document, frames, Event, drawn = []) {
  for (let turn = 0; turn < 5; turn++) {
    await flush();
    const slot = document.querySelector('[data-figure-warmup]');
    if (!slot) continue;
    drawn.push({
      figures: [...slot.querySelectorAll('iframe')].map((frame) => frame.getAttribute('src')),
      filters: slot.querySelectorAll('[data-warm-filter]').length,
    });
    for (const frame of slot.querySelectorAll('iframe')) loadFigure(frame, Event);
    for (let i = 0; i < 25; i++) {
      await flush();
      frames.flush(16 * i);
    }
  }
  return drawn;
}
const now = async () => {};

test('draws the figures one at a time, fetching them ahead, and remembers each', async (t) => {
  const stored = {};
  const { document, frames, Event, warmInTurn } = await page(t, { stored });
  const done = warmInTurn(sources, 'v2', [['blur(2px)', 'blur(0px)']], now);
  const drawn = await drawEach(document, frames, Event);
  await done;
  assert.deepEqual(
    [...document.querySelectorAll('link[rel=prefetch]')].map((link) => link.getAttribute('href')),
    ['/figures/a/', '/figures/b/'],
  );
  assert.deepEqual(drawn, [
    { figures: ['/figures/a/'], filters: 1 },
    { figures: ['/figures/b/'], filters: 0 },
  ]);
  assert.deepEqual(JSON.parse(stored['figure-warmup']), ['/figures/a/#v2', '/figures/b/#v2']);
});

test('skips figures remembered under this version, and remembers those the page shows', async (t) => {
  const stored = { 'figure-warmup': JSON.stringify(['/figures/a/#v2']) };
  const markup = '<iframe src="/figures/b/"></iframe>';
  const { document, frames, Event, warmInTurn } = await page(t, { stored, markup });
  loadFigure(document.querySelector('iframe'), Event);
  const done = warmInTurn(sources, 'v2', [], now);
  const drawn = await drawEach(document, frames, Event);
  await done;
  assert.deepEqual(drawn, []);
  assert.deepEqual(JSON.parse(stored['figure-warmup']), ['/figures/a/#v2', '/figures/b/#v2']);
});

test('draws again what was remembered under an earlier version, and forgets that version', async (t) => {
  const stored = { 'figure-warmup': JSON.stringify(['/figures/a/#v1', '/figures/b/#v2']) };
  const { document, frames, Event, warmInTurn } = await page(t, { stored });
  const done = warmInTurn(sources, 'v2', [], now);
  const drawn = await drawEach(document, frames, Event);
  await done;
  assert.deepEqual(drawn, [{ figures: ['/figures/a/'], filters: 0 }]);
  assert.deepEqual(JSON.parse(stored['figure-warmup']), ['/figures/b/#v2', '/figures/a/#v2']);
});

test('waits for a quiet moment before each figure', async (t) => {
  const { document, frames, Event, warmInTurn } = await page(t);
  const moments = [];
  const quiet = () => new Promise((resolve) => moments.push(resolve));
  const done = warmInTurn(sources, 'v2', [], quiet);
  await flush();
  assert.equal(moments.length, 1);
  assert.equal(document.querySelector('[data-figure-warmup]'), null, 'nothing drawn until quiet');
  moments[0]();
  assert.deepEqual(await drawEach(document, frames, Event), [
    { figures: ['/figures/a/'], filters: 0 },
  ]);
  assert.equal(moments.length, 2, 'the next figure waits for its own quiet moment');
  moments[1]();
  await drawEach(document, frames, Event);
  await done;
});

test('load and elapsed frames cannot complete warm-up before every renderer draws', async (t) => {
  const { document, frames, Event, warmFigures } = await page(t);
  const done = warmFigures([sources[0]], [], 5000);
  const inner = loadFigure(document.querySelector('iframe'), Event, false);
  let settled = false;
  void done.then(() => (settled = true));
  await flush();
  for (let i = 0; i < 30; i++) {
    frames.flush();
    await flush();
  }
  assert.equal(settled, false, 'a loaded document is not a rendered figure');
  inner.querySelector('[data-figure-drawn]').setAttribute('data-figure-drawn', '');
  for (let i = 0; i < 23; i++) {
    frames.flush();
    await flush();
  }
  assert.equal(settled, false, 'the sweep starts after readiness');
  frames.flush();
  await flush();
  assert.equal(await done, true);
  assert.equal(frames.pending.size, 0);
});

test('a loaded figure that never draws times out and cancels its frame work', async (t) => {
  const { document, frames, Event, warmFigures } = await page(t);
  const done = warmFigures([sources[0]], [], 20);
  loadFigure(document.querySelector('iframe'), Event, false);
  assert.equal(await done, false);
  assert.equal(document.querySelector('[data-figure-warmup]'), null);
  assert.equal(frames.pending.size, 0);
});

test('a visible but undrawn figure is skipped without a false success record', async (t) => {
  const stored = {};
  const { document, Event, warmInTurn } = await page(t, {
    stored,
    markup: '<iframe src="/figures/a/"></iframe>',
  });
  loadFigure(document.querySelector('iframe'), Event, false);
  await warmInTurn([sources[0]], 'v2', [], now);
  assert.equal(stored['figure-warmup'], undefined);
  assert.equal(document.querySelector('[data-figure-warmup]'), null);
});
