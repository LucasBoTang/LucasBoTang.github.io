import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { installGlobals } from '../helpers/browser.mjs';

let instance = 0;
async function wordmarkRenderer(t, { height = 40, ascent = 32 } = {}) {
  const { document } = parseHTML(`<html><body><span class="project-wordmark">
    <span class="project-glyphs"><span class="project-face">REINS</span><span class="project-echo"></span></span>
  </span></body></html>`);
  const fonts = Promise.withResolvers();
  document.fonts = { ready: fonts.promise };
  const glyphs = document.querySelector('.project-glyphs');
  const face = document.querySelector('.project-face');
  const echo = document.querySelector('.project-echo');
  const node = document.querySelector('.project-wordmark');
  const reads = { box: 0, style: 0, text: 0 };
  const metrics = {
    fontBoundingBoxAscent: ascent,
    fontBoundingBoxDescent: 8,
    actualBoundingBoxAscent: 24,
    actualBoundingBoxDescent: 0,
  };
  const measure = {
    measureText(text) {
      reads.text++;
      assert.equal(text, 'REINS');
      return metrics;
    },
  };
  glyphs.getBoundingClientRect = () => {
    reads.box++;
    return { height };
  };
  const createElement = document.createElement.bind(document);
  document.createElement = (tag) =>
    tag === 'canvas' ? { getContext: () => measure } : createElement(tag);
  const resizes = [];
  installGlobals(t, {
    document,
    getComputedStyle() {
      reads.style++;
      return { fontWeight: '400', fontSize: '40px', fontFamily: 'Bodoni Moda' };
    },
    ResizeObserver: class {
      constructor(callback) {
        resizes.push(callback);
      }
      observe(target) {
        assert.equal(target, glyphs);
      }
    },
  });
  const { createWordmarkRenderer } = await import(
    `../../src/components/catalogue/ProjectWordmark/wordmark-renderer.ts?test=${++instance}`
  );
  const renderer = createWordmarkRenderer(node);
  const animations = [];
  for (const layer of glyphs.children) {
    layer.animate = (keyframes, options) => {
      const animation = {
        keyframes,
        options,
        cancelled: false,
        cancel() {
          this.cancelled = true;
        },
      };
      animations.push(animation);
      layer.getAnimations = () => [animation];
      return animation;
    };
  }
  return {
    renderer,
    node,
    glyphs,
    face,
    echo,
    reads,
    measure,
    metrics,
    fonts,
    animations,
    resize: () => resizes.forEach((callback) => callback()),
  };
}

test('wordmark drawing caches ink measurements until font readiness or a resize', async (t) => {
  t.mock.method(Math, 'random', () => 0.25);
  const w = await wordmarkRenderer(t);
  assert.deepEqual(w.reads, { box: 0, style: 0, text: 0 });
  w.renderer.draw(1);
  assert.equal(w.measure.font, '400 40px Bodoni Moda');
  assert.equal(
    w.face.style.maskImage,
    'linear-gradient(to bottom, black 34.0%, transparent 34.0%, transparent 38.0%, black 38.0%)',
  );
  assert.equal(
    w.node.querySelector('.project-band').style.clipPath,
    'inset(34.0% -40px 62.0% -40px)',
  );
  w.renderer.draw(0.3);
  assert.deepEqual(
    w.reads,
    { box: 1, style: 1, text: 1 },
    'a new tear does not remeasure its word',
  );
  w.fonts.resolve();
  await Promise.resolve();
  assert.deepEqual(w.reads, { box: 1, style: 1, text: 1 }, 'invalidation stays lazy');
  w.renderer.draw(1);
  assert.deepEqual(w.reads, { box: 2, style: 2, text: 2 });
  w.resize();
  w.renderer.draw(1);
  assert.deepEqual(w.reads, { box: 3, style: 3, text: 3 });
});

test('wordmark entrance and tear layers use the same ink geometry and settle cleanly', async (t) => {
  t.mock.method(Math, 'random', () => 0.25);
  const w = await wordmarkRenderer(t);
  const entrance = w.renderer.prepareEntrance(140);
  assert.equal(entrance.length, 3);
  assert.equal(w.node.querySelector('.project-beam').style.top, '50.0%');
  assert.equal(w.face.style.transformOrigin, 'center 50.0%');
  assert.ok(entrance.every(({ options }) => options.delay === 140 && options.fill === 'backwards'));
  w.renderer.draw(1);
  assert.equal(w.node.hasAttribute('data-glitching'), true);
  assert.equal(w.echo.style.opacity, '0.320');
  w.renderer.settle();
  assert.equal(w.node.hasAttribute('data-glitching'), false);
  assert.equal(w.face.style.maskImage, '');
  assert.equal(w.echo.hasAttribute('style'), false);
  assert.ok(
    [...w.node.querySelectorAll('.project-band')].every(
      (band) => !band.hasAttribute('style') && !band.hasAttribute('data-torn'),
    ),
  );
  w.renderer.cancelEntrance();
  assert.ok(entrance.every((animation) => animation.cancelled));
});

for (const [name, options] of [
  ['missing font metrics', { ascent: NaN }],
  ['zero line height', { height: 0 }],
]) {
  test(`wordmark drawing keeps fallback ink bounds with ${name}`, async (t) => {
    t.mock.method(Math, 'random', () => 0.25);
    const w = await wordmarkRenderer(t, options);
    w.renderer.draw(1);
    assert.equal(
      w.face.style.maskImage,
      'linear-gradient(to bottom, black 36.7%, transparent 36.7%, transparent 40.0%, black 40.0%)',
    );
  });
}
