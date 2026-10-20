import assert from 'node:assert/strict';
import test from 'node:test';
import { onScrollFrame } from '../../src/lib/lifecycle.ts';

function browserFrames(t) {
  const events = new EventTarget();
  const frames = new Map();
  let nextId = 0;
  const replacements = {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    requestAnimationFrame: (callback) => {
      frames.set(++nextId, callback);
      return nextId;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  for (const [key, value] of Object.entries(replacements)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  }
  return {
    emit: (name) => events.dispatchEvent(new Event(name)),
    flush() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    },
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
