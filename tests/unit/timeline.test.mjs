import assert from 'node:assert/strict';
import test from 'node:test';
import { installGlobals, intersectionObservers } from '../helpers/browser.mjs';
import { registerTypeScriptImports } from '../helpers/typescript-imports.mjs';

// Browser modules use extensionless relative imports; Node needs their TypeScript extension.
const hooks = registerTypeScriptImports();
let createTimeline;
try {
  ({ createTimeline } = await import('../../src/lib/timeline.ts'));
} finally {
  hooks.deregister();
}

test('a finished timeline does not create new animations, timers or viewport waits', (t) => {
  installGlobals(t, {
    window: {
      clearTimeout,
      setTimeout() {
        assert.fail('finished timelines must not allocate timers');
      },
    },
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
  const observers = intersectionObservers();
  let called = false;
  installGlobals(t, {
    window: { innerHeight: 900, IntersectionObserver: observers.Observer, clearTimeout },
    IntersectionObserver: observers.Observer,
  });
  const timeline = createTimeline();
  timeline.whenVisible({ getBoundingClientRect: () => ({ top: 1000 }) }, () => {
    called = true;
  });
  timeline.finish();
  observers.instances[0].callback([{ isIntersecting: true }]);
  assert.equal(called, false);
});
