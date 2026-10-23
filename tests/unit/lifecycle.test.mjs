import assert from 'node:assert/strict';
import test from 'node:test';
import { onScrollFrame } from '../../src/lib/lifecycle.ts';
import { frameQueue, installGlobals } from '../helpers/browser.mjs';

function browserFrames(t) {
  const events = new EventTarget();
  const queue = frameQueue();
  const frames = queue.pending;
  const replacements = {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    requestAnimationFrame: queue.request,
    cancelAnimationFrame: queue.cancel,
  };
  installGlobals(t, replacements);
  return {
    emit: (name) => events.dispatchEvent(new Event(name)),
    flush: queue.flush,
    frames,
  };
}

test('scroll, resize and explicit requests share one update per frame', (t) => {
  const browser = browserFrames(t);
  let updates = 0;
  const subscription = onScrollFrame(() => updates++);
  browser.emit('scroll');
  browser.emit('resize');
  subscription.request();
  assert.equal(updates, 0);
  assert.equal(browser.frames.size, 1);
  browser.flush();
  assert.equal(updates, 1);
  browser.emit('scroll');
  browser.flush();
  assert.equal(updates, 2);
  subscription.stop();
});

test('stopping cancels a pending frame and prevents subsequent updates', (t) => {
  const browser = browserFrames(t);
  let updates = 0;
  const subscription = onScrollFrame(() => updates++);
  browser.emit('scroll');
  subscription.stop();
  subscription.stop();
  assert.equal(browser.frames.size, 0);
  browser.flush();
  browser.emit('scroll');
  browser.emit('resize');
  subscription.request();
  assert.equal(browser.frames.size, 0);
  browser.flush();
  assert.equal(updates, 0);
});
