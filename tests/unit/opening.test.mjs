import assert from 'node:assert/strict';
import test from 'node:test';
import { openingTiming as time } from '../../src/components/home/opening/opening.ts';

test('the portrait glitches in while its darker dots are still landing', () => {
  assert.ok(time.formStart + 150 <= time.glitchStart, 'the face can be made out first');
  assert.ok(time.glitchStart < time.formEnd, 'the glitch starts while the picture is forming');
  assert.ok(time.formEnd <= time.glitchEnd, 'every dot lands before the photograph takes over');
});

test('the shift follows straight out of the glitch, and the name decodes across both', () => {
  assert.equal(time.shiftStart, time.glitchEnd);
  assert.equal(time.blueStart, time.glitchEnd);
  assert.equal(time.split, time.blueStart - 1);
  assert.ok(time.glitchStart < time.tearStart && time.tearStart < time.shiftEnd);
});
