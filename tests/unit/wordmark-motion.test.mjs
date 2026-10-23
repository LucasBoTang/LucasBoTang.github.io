import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { frameQueue, installGlobals, mediaQuery } from '../helpers/browser.mjs';
import { registerTypeScriptImports } from '../helpers/typescript-imports.mjs';

let instance = 0;
async function wordmark(t, visible = false, withPreview = false) {
  const { document, Element, CustomEvent, MutationObserver } = parseHTML(`<html><body>
    <article data-project-host>${withPreview ? '<a data-figure-preview>' : ''}<span class="project-wordmark"><span class="project-glyphs">
      <span class="project-face">REINS</span><span class="project-echo"></span>
    </span></span>${withPreview ? '</a>' : ''}</article></body></html>`);
  document.fonts = { ready: Promise.resolve() };
  const frames = frameQueue();
  const observers = [];
  const queries = [];
  const animations = [];
  const originalBox = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
  const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
  const originalAnimations = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  const layers = new WeakMap();
  t.after(() => {
    if (originalBox) Object.defineProperty(Element.prototype, 'getBoundingClientRect', originalBox);
    else delete Element.prototype.getBoundingClientRect;
    if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate);
    else delete Element.prototype.animate;
    if (originalAnimations)
      Object.defineProperty(Element.prototype, 'getAnimations', originalAnimations);
    else delete Element.prototype.getAnimations;
  });
  Element.prototype.getBoundingClientRect = () => ({
    top: visible ? 0 : 1000,
    bottom: visible ? 40 : 1040,
    height: 40,
  });
  Element.prototype.getAnimations = function () {
    return layers.get(this) ?? [];
  };
  Element.prototype.animate = function () {
    const animation = {
      playState: 'running',
      plays: 0,
      effect: { updateTiming() {} },
      play() {
        this.playState = 'running';
        this.plays++;
      },
      pause() {
        this.playState = 'paused';
      },
      cancel() {
        this.playState = 'idle';
      },
    };
    animations.push(animation);
    layers.set(this, [...(layers.get(this) ?? []), animation]);
    return animation;
  };
  const createElement = document.createElement.bind(document);
  document.createElement = (tag) =>
    tag === 'canvas' ? { getContext: () => null } : createElement(tag);
  class Observer {
    constructor(callback) {
      observers.push(callback);
    }
    observe() {}
  }
  const globals = {
    document,
    Element,
    MutationObserver,
    window: { IntersectionObserver: Observer },
    innerHeight: 800,
    IntersectionObserver: Observer,
    ResizeObserver: class {
      observe() {}
    },
    matchMedia: () => {
      const query = mediaQuery();
      queries.push(query);
      return query;
    },
    getComputedStyle: () => ({}),
    requestAnimationFrame: frames.request,
    cancelAnimationFrame: frames.cancel,
  };
  installGlobals(t, globals);
  const hooks = registerTypeScriptImports();
  try {
    await import(
      `../../src/components/catalogue/ProjectWordmark/wordmark-motion.ts?test=${++instance}`
    );
  } finally {
    hooks.deregister();
  }
  const node = document.querySelector('.project-wordmark');
  return {
    animations,
    frames,
    host: document.querySelector('article'),
    preview: document.querySelector('[data-figure-preview]'),
    point() {
      document.querySelector('article').dispatchEvent(new CustomEvent('pointerenter'));
    },
    arrive() {
      document
        .querySelector('article')
        .dispatchEvent(new CustomEvent('arrival', { detail: { delay: 0 } }));
    },
    reduce() {
      for (const query of queries) {
        query.matches = true;
        query.dispatchEvent(new globalThis.Event('change'));
      }
    },
    show() {
      visible = true;
      observers.forEach((report) =>
        report([{ target: node, isIntersecting: true, intersectionRatio: 1 }]),
      );
    },
  };
}

test('reducing motion releases a wordmark held dark outside the viewport', async (t) => {
  const w = await wordmark(t);
  w.arrive();
  assert.equal(w.animations.length, 3);
  assert.ok(w.animations.every((animation) => animation.playState === 'paused'));
  w.reduce();
  assert.ok(
    w.animations.every((animation) => animation.playState === 'idle'),
    'the static word must replace the paused power-on',
  );
  w.show();
  assert.ok(
    w.animations.every((animation) => animation.plays === 0),
    'entering view must not replay a cancelled power-on',
  );
});

test('reducing motion also releases an in-progress wordmark power-on', async (t) => {
  const w = await wordmark(t, true);
  w.arrive();
  assert.ok(w.animations.every((animation) => animation.playState === 'running'));
  w.reduce();
  assert.ok(w.animations.every((animation) => animation.playState === 'idle'));
});

test('normal wordmark power-on still waits for visibility and then plays once', async (t) => {
  const w = await wordmark(t);
  w.arrive();
  assert.ok(w.animations.every((animation) => animation.playState === 'paused'));
  w.show();
  assert.ok(w.animations.every((animation) => animation.playState === 'running'));
  assert.ok(w.animations.every((animation) => animation.plays === 1));
  w.show();
  assert.ok(w.animations.every((animation) => animation.plays === 1));
});

test('home wordmarks keep trembling through selection and loading, until the preview connects', async (t) => {
  const w = await wordmark(t, true, true);
  w.show();
  assert.equal(w.frames.pending.size, 1);
  w.point();
  assert.equal(w.frames.pending.size, 1, 'pointer intent must not freeze the waiting wordmark');
  w.host.setAttribute('data-focused', '');
  w.preview.setAttribute('data-preview-pending', '');
  await Promise.resolve();
  assert.equal(w.frames.pending.size, 1, 'selection and a pending document keep the signal alive');
  w.preview.setAttribute('data-preview-visible', '');
  await Promise.resolve();
  assert.equal(w.frames.pending.size, 0, 'stop the old tremor when acquisition takes over');
  w.preview.removeAttribute('data-preview-visible');
  await Promise.resolve();
  assert.equal(w.frames.pending.size, 1, 'resume when the wordmark returns, even while selected');
  w.reduce();
  assert.equal(w.frames.pending.size, 0, 'reduced motion still keeps the wordmark still');
});

test('wordmarks without previews still hold clean while pointed at', async (t) => {
  const w = await wordmark(t, true);
  w.show();
  assert.equal(w.frames.pending.size, 1);
  w.point();
  assert.equal(w.frames.pending.size, 0);
});
