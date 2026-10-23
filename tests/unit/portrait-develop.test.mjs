import assert from 'node:assert/strict';
import test from 'node:test';
import { frameQueue, installGlobals } from '../helpers/browser.mjs';
import { registerTypeScriptImports } from '../helpers/typescript-imports.mjs';

const hooks = registerTypeScriptImports();
let createPortraitDevelop;
try {
  ({ createPortraitDevelop } =
    await import('../../src/components/home/HomeHero/portrait-develop.ts'));
} finally {
  hooks.deregister();
}

function portrait(t) {
  const idle = [];
  const queue = frameQueue();
  const frames = queue.pending;
  let canvases = 0;
  const pixels = (width, height) => ({
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  });
  const context = {
    clearRect() {},
    drawImage() {},
    putImageData() {},
    createImageData: pixels,
    getImageData: (_x, _y, width, height) => pixels(width, height),
  };
  const box = () => ({ left: 0, top: 0, width: 8, height: 8 });
  const canvas = () => {
    canvases++;
    return { width: 8, height: 8, getContext: () => context, getBoundingClientRect: box };
  };
  class Image {
    complete = true;
    naturalWidth = 2;
    naturalHeight = 2;
    decode() {
      return Promise.resolve();
    }
  }
  const image = new Image();
  const target = {
    ...canvas(),
    dataset: { portraitPixels: '/pixels.png' },
    parentElement: { getBoundingClientRect: box },
  };
  const hero = { querySelector: (selector) => (selector === '.portrait' ? image : target) };
  const globals = {
    Image,
    document: { documentElement: { hasAttribute: () => false }, createElement: canvas },
    matchMedia: () => ({ matches: false }),
    devicePixelRatio: 1,
    getComputedStyle: () => ({ getPropertyValue: () => '0' }),
    requestIdleCallback: (work) => idle.push(work),
    requestAnimationFrame: queue.request,
    cancelAnimationFrame: queue.cancel,
  };
  installGlobals(t, globals);
  const develop = createPortraitDevelop(hero);
  return {
    develop,
    frames,
    allocations: () => canvases,
    async prepare() {
      await new Promise((resolve) => setImmediate(resolve));
      idle.splice(0).forEach((work) => work());
      await develop.ready;
    },
  };
}

test('playing before idle preparation does not allocate a second portrait', async (t) => {
  const p = portrait(t);
  assert.equal(p.develop.play(), true);
  assert.equal(p.frames.size, 1);
  const allocated = p.allocations();
  await p.prepare();
  assert.equal(
    p.allocations(),
    allocated,
    'late idle preparation must not rebuild the running portrait',
  );
  p.develop.stop();
});

test('skipping the opening before idle preparation avoids unused portrait buffers', async (t) => {
  const p = portrait(t);
  p.develop.stop();
  const allocated = p.allocations();
  await p.prepare();
  assert.equal(
    p.allocations(),
    allocated,
    'a skipped entrance must not prepare offscreen canvases',
  );
  assert.equal(p.frames.size, 0);
});

test('an already prepared portrait starts once and stops its frame', async (t) => {
  const p = portrait(t);
  await p.prepare();
  const allocated = p.allocations();
  assert.equal(p.develop.play(), true);
  assert.equal(p.allocations(), allocated, 'playing consumes the prepared portrait');
  assert.equal(p.frames.size, 1);
  assert.equal(p.develop.play(), false);
  assert.equal(p.frames.size, 1, 'the one-shot entrance cannot acquire another animation loop');
  p.develop.stop();
  assert.equal(p.frames.size, 0);
  assert.equal(p.develop.play(), false);
});
