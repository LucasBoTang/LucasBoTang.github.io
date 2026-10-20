import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Browser modules use extensionless relative imports; Node needs their TypeScript extension.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const { createTimeline } = await import('../../src/lib/timeline.ts');
hooks.deregister();

test('a finished timeline does not create new animations, timers or viewport waits', (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    clearTimeout,
    setTimeout() {
      assert.fail('finished timelines must not allocate timers');
    },
  };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const timeline = createTimeline();
  timeline.finish();
  const element = {
    animate() {
      assert.fail('finished timelines must not hide content with a new animation');
    },
    getBoundingClientRect() {
      assert.fail('finished timelines must not measure or observe content');
    },
  };
  timeline.animate(element, [], { duration: 100 }, 'test');
  timeline.appear(element, 0, 'test', 100);
  timeline.whenVisible(element, () => assert.fail('finished callback'));
  timeline.later(() => assert.fail('finished callback'), 0);
  timeline.start('test');
  timeline.finish();
  assert.equal(timeline.finished, true);
});

test('queued viewport notifications cannot call back after the timeline finishes', (t) => {
  const previousWindow = globalThis.window;
  const previousObserver = globalThis.IntersectionObserver;
  let notify;
  let called = false;
  class Observer {
    constructor(callback) {
      notify = callback;
    }
    observe() {}
    disconnect() {}
  }
  globalThis.window = { innerHeight: 900, IntersectionObserver: Observer, clearTimeout };
  globalThis.IntersectionObserver = Observer;
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousObserver === undefined) delete globalThis.IntersectionObserver;
    else globalThis.IntersectionObserver = previousObserver;
  });
  const timeline = createTimeline();
  timeline.whenVisible({ getBoundingClientRect: () => ({ top: 1000 }) }, () => {
    called = true;
  });
  timeline.finish();
  notify([{ isIntersecting: true }]);
  assert.equal(called, false);
});
