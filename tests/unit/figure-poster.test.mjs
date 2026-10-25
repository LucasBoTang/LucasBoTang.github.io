import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { presentFigureWhenDrawn } from '../../src/components/catalogue/FigureFrame/figure-poster.ts';
import { frameQueue, installGlobals, mediaQuery } from '../helpers/browser.mjs';

const flush = () => new Promise((resolve) => setImmediate(resolve));

function poster(t) {
  const { document, MutationObserver, Event } = parseHTML(
    '<div data-figure-poster-pending><picture data-figure-poster><img></picture><iframe></iframe></div>',
  );
  const inner = parseHTML(
    '<html><body><canvas data-figure-drawn=""></canvas></body></html>',
  ).document;
  Object.assign(inner, {
    URL: '/figure/',
    readyState: 'complete',
    fonts: { ready: Promise.resolve() },
    images: [],
  });
  const host = document.querySelector('div');
  const frame = host.querySelector('iframe');
  frame.contentDocument = inner;
  const image = host.querySelector('img');
  Object.assign(image, { complete: true, naturalWidth: 600 });
  const paints = frameQueue();
  const animations = [];
  host.querySelector('picture').animate = () => {
    const done = Promise.withResolvers();
    const animation = {
      finished: done.promise,
      cancel: () => done.reject(new Error('cancelled')),
      finish: done.resolve,
    };
    animations.push(animation);
    return animation;
  };
  installGlobals(t, {
    MutationObserver,
    requestAnimationFrame: paints.request,
    cancelAnimationFrame: paints.cancel,
    matchMedia: () => mediaQuery(false),
  });
  presentFigureWhenDrawn(host, frame);
  return { host, frame, Event, paints, animations };
}

test('a cancelled poster handover must not release playback for a new load', async (t) => {
  const p = poster(t);
  await flush();
  p.paints.flush();
  p.paints.flush();
  assert.equal(p.animations.length, 1);
  p.frame.dispatchEvent(new p.Event('load'));
  await flush();
  assert.ok(p.host.hasAttribute('data-figure-poster-pending'));
  assert.equal(p.host.hasAttribute('data-figure-live'), false);
  p.paints.flush();
  p.paints.flush();
  p.animations.at(-1).finish();
  await flush();
  assert.equal(p.host.hasAttribute('data-figure-poster-pending'), false);
  assert.ok(p.host.hasAttribute('data-figure-live'));
});
