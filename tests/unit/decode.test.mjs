import assert from 'node:assert/strict';
import test from 'node:test';
import { DECODE_STEP_MS, decodeNoise, sampleDecode } from '../../src/lib/decode.ts';

test('shared decode cadence preserves flash and blink steps while calming the letter', () => {
  assert.equal(DECODE_STEP_MS, 45);
  const flash = decodeNoise(0, 3, 1);
  assert.deepEqual(flash.block, { top: 0.74, height: 0.2, tone: 'blue' });
  assert.equal(flash.hop, -0.22);
  assert.equal(flash.blink, false);
  assert.ok(flash.opacity >= 0.45 && flash.opacity <= 0.85);
  assert.equal(decodeNoise(0, 6, 1).blink, true);
  const calmer = decodeNoise(0, 3, 0.5);
  assert.equal(calmer.hop, flash.hop / 2);
  assert.ok(calmer.opacity > flash.opacity);
  const settled = decodeNoise(0, 3, 0);
  assert.equal(Math.abs(settled.hop), 0);
  assert.equal(settled.opacity, 1);
});

test('decode sampling respects break, lock, phase and the last character step', () => {
  const before = sampleDecode(2, 99, 100, 300, 3);
  assert.equal(before.broken, false);
  assert.equal(before.decoding, false);
  const beginning = sampleDecode(2, 100, 100, 300, 3);
  assert.equal(beginning.step, 0);
  assert.equal(beginning.toLock, 5);
  assert.deepEqual(beginning.noise, decodeNoise(2, 6, 5 / 6));
  assert.equal(sampleDecode(2, 299.999, 100, 300).locked, false);
  const settled = sampleDecode(2, 300, 100, 300);
  assert.equal(settled.locked, true);
  assert.equal(settled.decoding, false);
  assert.equal(settled.noise.opacity, 1);
});
