import assert from 'node:assert/strict';
import test from 'node:test';
import { frameQueue, installGlobals } from '../helpers/browser.mjs';
import { registerTypeScriptImports } from '../helpers/typescript-imports.mjs';

const hooks = registerTypeScriptImports();
let whenSignVisible, ARRIVAL_EVENT;
try {
  ({ whenSignVisible } = await import('../../src/components/home/AboutSection/sign-opening.ts'));
  ({ ARRIVAL_EVENT } = await import('../../src/lib/arrival.ts'));
} finally {
  hooks.deregister();
}

async function sign(t, progress = 0, state = 'paused') {
  const frames = frameQueue();
  let reject;
  const animation = {
    playState: state,
    effect: {
      getKeyframes: () => [{ opacity: 0 }, { opacity: 1 }],
      getComputedTiming: () => ({ progress }),
    },
    finished: new Promise((_, failed) => {
      reject = failed;
    }),
  };
  const section = Object.assign(new EventTarget(), { getAnimations: () => animations });
  let animations = [animation];
  installGlobals(t, {
    document: { documentElement: { hasAttribute: () => false } },
    requestAnimationFrame: frames.request,
    cancelAnimationFrame: frames.cancel,
    getComputedStyle: () => {
      throw new Error('Sign startup must not read computed styles');
    },
  });
  let shown = 0;
  whenSignVisible(section, () => shown++);
  await Promise.resolve();
  return {
    frames,
    get shown() {
      return shown;
    },
    arrive() {
      animation.playState = 'running';
      section.dispatchEvent(new Event(ARRIVAL_EVENT));
    },
    progress(value) {
      progress = value;
      frames.flush();
    },
    cancel() {
      animations = [];
      reject(new Error('Opening skipped'));
    },
  };
}

test('the prepared sign sleeps until arrival, then starts at its original visibility threshold', async (t) => {
  const s = await sign(t);
  assert.equal(s.shown, 0);
  assert.equal(s.frames.pending.size, 0);
  s.arrive();
  s.progress(0.049);
  assert.equal(s.shown, 0);
  s.progress(0.05);
  assert.equal(s.shown, 1);
  assert.equal(s.frames.pending.size, 0);
  s.arrive();
  assert.equal(s.shown, 1);
});

test('late sign initialization starts immediately during an already visible fade', async (t) => {
  const s = await sign(t, 0.4, 'running');
  assert.equal(s.shown, 1);
  assert.equal(s.frames.pending.size, 0);
});

test('cancelling the opening releases a prepared sign instead of leaving it dark', async (t) => {
  const s = await sign(t);
  s.cancel();
  await Promise.resolve();
  assert.equal(s.shown, 1);
});
