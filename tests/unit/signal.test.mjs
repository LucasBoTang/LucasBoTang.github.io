import assert from 'node:assert/strict';
import test from 'node:test';
import { titleInterval } from '../../src/lib/signal.ts';

test('page titles glitch again after 7 to 12 seconds, at an uneven moment', () => {
  assert.equal(titleInterval(0), 7000);
  assert.equal(titleInterval(1), 12000);
  assert.equal(titleInterval(0.5), 9500);
});
