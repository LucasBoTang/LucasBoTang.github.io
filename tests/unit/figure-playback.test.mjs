import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayback } from '../../src/components/catalogue/GpuFigure/playback.ts';

function harness() {
  const motion = new EventTarget();
  motion.matches = false;
  const document = new EventTarget();
  document.hidden = false;
  const frames = new Map();
  let sequence = 0;
  let observe;
  let disconnected = false;
  const browser = {
    document,
    matchMedia: () => motion,
    requestAnimationFrame: (callback) => {
      frames.set(++sequence, callback);
      return sequence;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    IntersectionObserver: class {
      constructor(callback) {
        observe = callback;
      }
      observe() {}
      disconnect() {
        disconnected = true;
      }
    },
  };
  return {
    browser,
    motion,
    document,
    frames,
    visible(value) {
      observe([{ isIntersecting: value }]);
    },
    frame(time) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(time));
    },
    get disconnected() {
      return disconnected;
    },
  };
}

test('GPU playback freezes offscreen and resumes without counting the hidden interval', () => {
  const env = harness(),
    readings = [];
  const playback = createPlayback({}, env.browser, (time) => readings.push(time));
  assert.equal(env.frames.size, 0);
  env.visible(true);
  env.frame(100);
  env.frame(200);
  assert.equal(readings.at(-1), 100);
  env.visible(false);
  assert.equal(env.frames.size, 0);
  env.visible(true);
  env.frame(10000);
  env.frame(10100);
  assert.equal(readings.at(-1), 200);
  playback.dispose();
  assert.equal(env.frames.size, 0);
  assert.ok(env.disconnected);
});

test('background tabs and reduced motion suppress animation and retain a static drawing', () => {
  const env = harness(),
    readings = [];
  const playback = createPlayback({}, env.browser, (time, reduced) =>
    readings.push({ time, reduced }),
  );
  env.visible(true);
  env.frame(100);
  env.frame(200);
  env.document.hidden = true;
  env.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(env.frames.size, 0);
  env.document.hidden = false;
  env.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(env.frames.size, 1);
  env.motion.matches = true;
  env.motion.dispatchEvent(new Event('change'));
  assert.equal(env.frames.size, 0);
  assert.deepEqual(readings.at(-1), { time: 100, reduced: true });
  playback.dispose();
  env.motion.matches = false;
  env.motion.dispatchEvent(new Event('change'));
  assert.equal(env.frames.size, 0);
});
