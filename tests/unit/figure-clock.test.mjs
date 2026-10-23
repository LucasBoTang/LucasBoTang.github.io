import assert from 'node:assert/strict';
import test from 'node:test';
import { createFigureClock } from '../../src/lib/figure-clock.ts';
import { animationBrowser } from '../helpers/animation-browser.mjs';

test('Figure playback freezes offscreen and resumes without counting the hidden interval', (t) => {
  const env = animationBrowser(t),
    readings = [];
  const playback = createFigureClock({}, (time) => readings.push(time));
  assert.equal(env.frames.size, 0);
  env.visible(true);
  env.frame(100);
  env.frame(200);
  assert.equal(readings.at(-1), 80);
  env.visible(false);
  assert.equal(env.frames.size, 0);
  env.visible(true);
  env.frame(10000);
  env.frame(10100);
  assert.equal(readings.at(-1), 160);
  playback.dispose();
  assert.equal(env.frames.size, 0);
  assert.ok(env.disconnected);
});

test('background tabs and reduced motion suppress animation and retain a static drawing', (t) => {
  const env = animationBrowser(t),
    readings = [];
  const playback = createFigureClock({}, (time, reduced) => readings.push({ time, reduced }));
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
  assert.deepEqual(readings.at(-1), { time: 80, reduced: true });
  playback.dispose();
  env.motion.matches = false;
  env.motion.dispatchEvent(new Event('change'));
  assert.equal(env.frames.size, 0);
});

test('the host entrance holds the clock while the static first frame is already drawn', (t) => {
  const env = animationBrowser(t),
    readings = [];
  let release;
  const playback = createFigureClock({}, (time) => readings.push(time), {
    startWhen: (start) => {
      release = start;
    },
  });
  env.visible(true);
  env.frame(100);
  env.frame(200);
  assert.deepEqual(readings, [0, 0], 'preparing the picture must not advance its clock');
  assert.equal(env.frames.size, 0);
  release();
  env.frame(10000);
  env.frame(10100);
  assert.equal(readings.at(-1), 80, 'time waiting for the entrance is excluded');
  playback.dispose();
});

test('finite playback draws its exact final frame and stops scheduling work', (t) => {
  const env = animationBrowser(t),
    readings = [];
  const playback = createFigureClock({}, (time) => readings.push(time), {
    duration: 18500,
    maxFrameDelta: Infinity,
  });
  env.visible(true);
  env.frame(100);
  env.frame(18590);
  assert.equal(env.frames.size, 1);
  env.frame(18620);
  assert.equal(readings.at(-1), 18500);
  assert.equal(env.frames.size, 0, 'a completed static instrument must not keep a frame loop');
  env.visible(false);
  env.visible(true);
  assert.equal(
    env.frames.size,
    0,
    'returning to the viewport must not restart a finished instrument',
  );
  playback.redraw();
  assert.equal(readings.at(-1), 18500, 'resize can still redraw the completed result');
  env.motion.matches = true;
  env.motion.dispatchEvent(new Event('change'));
  env.motion.matches = false;
  env.motion.dispatchEvent(new Event('change'));
  assert.equal(env.frames.size, 0);
  playback.dispose();
});

test('the requested visible fraction gates playback in both directions', (t) => {
  const env = animationBrowser(t);
  const playback = createFigureClock({}, () => {}, { threshold: 0.05 });
  env.visible(true, 0.01);
  assert.equal(env.frames.size, 0);
  env.visible(true, 0.05);
  assert.equal(env.frames.size, 1);
  env.visible(true, 0.01);
  assert.equal(env.frames.size, 0);
  playback.dispose();
});

test('late entrance releases and queued visibility notifications cannot revive disposal', (t) => {
  const env = animationBrowser(t),
    readings = [];
  let release;
  const playback = createFigureClock({}, (time) => readings.push(time), {
    startWhen: (start) => {
      release = start;
    },
  });
  playback.dispose();
  const count = readings.length;
  release();
  env.visible(true);
  playback.redraw();
  assert.equal(env.frames.size, 0);
  assert.equal(readings.length, count);
});
