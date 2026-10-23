import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { loadFigureEmbeds } from '../../src/lib/figure-loading.ts';
import { intersectionObservers } from '../helpers/browser.mjs';

test('figure documents load only near the reader, once per figure', () => {
  const { document } = parseHTML(
    '<iframe data-figure-src="/gpu/"></iframe><iframe data-figure-src="/l2o/"></iframe>',
  );
  const frames = [...document.querySelectorAll('iframe')];
  const observers = intersectionObservers();
  loadFigureEmbeds(frames, observers.Observer);
  const { callback: report, options, targets: waiting } = observers.instances[0];
  assert.ok(frames.every((frame) => !frame.hasAttribute('src')));
  assert.equal(options.rootMargin, '240px 0px');
  report([{ target: frames[0], isIntersecting: false }]);
  assert.equal(frames[0].getAttribute('src'), null);
  report([{ target: frames[0], isIntersecting: true }]);
  assert.equal(frames[0].getAttribute('src'), '/gpu/');
  assert.equal(frames[1].getAttribute('src'), null);
  assert.equal(waiting.has(frames[0]), false);
  frames[0].setAttribute('src', '/already-running/');
  report([{ target: frames[0], isIntersecting: true }]);
  assert.equal(frames[0].getAttribute('src'), '/already-running/');
});

test('browsers without an observer still receive all figures', () => {
  const { document } = parseHTML('<iframe data-figure-src="/l2o/"></iframe>');
  const frame = document.querySelector('iframe');
  loadFigureEmbeds([frame], undefined);
  assert.equal(frame.getAttribute('src'), '/l2o/');
});
