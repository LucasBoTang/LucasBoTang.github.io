import assert from 'node:assert/strict';
import test from 'node:test';
import { glitchFrames } from '../../src/components/home/HomeHero/portrait-glitch.ts';
import { portraitTiming } from '../../src/components/home/opening/opening.ts';

test('fresh development lasts longer while the first interference arrives sooner', () => {
  const time = portraitTiming(false);
  assert.ok(time.formEnd >= 1000);
  assert.ok(time.glitchStart <= 320);
  assert.ok(time.shiftEnd >= 1400 && time.shiftEnd <= 1500);
  const frames = glitchFrames(600, 1, 24, time);
  assert.equal(frames.length, glitchFrames(600, 1, 24, portraitTiming(true)).length);
  let previous = time.glitchStart;
  for (const frame of frames) {
    assert.ok(frame.until > previous);
    assert.ok(frame.until - previous < 120, 'sustain activity with changes, not frozen frames');
    previous = frame.until;
  }
  assert.equal(previous, time.glitchEnd);
});

test('the portrait glitches in while its darker dots are still landing', () => {
  for (const time of [portraitTiming(false), portraitTiming(false, true), portraitTiming(true)]) {
    assert.ok(time.formStart + 150 <= time.glitchStart, 'the face can be made out first');
    assert.ok(time.glitchStart < time.formEnd, 'the glitch starts while the picture is forming');
    assert.ok(time.formEnd <= time.glitchEnd, 'every dot lands before the photograph takes over');
  }
});

test('the shift follows straight out of the glitch, and the name decodes across both', () => {
  for (const time of [portraitTiming(false), portraitTiming(false, true), portraitTiming(true)]) {
    assert.equal(time.shiftStart, time.glitchEnd);
    assert.equal(time.blueStart, time.glitchEnd);
    assert.equal(time.split, time.blueStart - 1);
    assert.ok(time.glitchStart < time.tearStart && time.tearStart < time.shiftEnd);
  }
});
