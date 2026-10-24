import assert from 'node:assert/strict';
import test from 'node:test';
import { mapInSlices } from '../../src/components/catalogue/L2oFigure/sliced-map.ts';
import { installGlobals } from '../helpers/browser.mjs';

test('mesh construction yields between expensive items and preserves exact order', async (t) => {
  let now = 0;
  const turns = [];
  const visited = [];
  installGlobals(t, {
    performance: { now: () => now },
    setTimeout: (callback) => {
      turns.push([...visited]);
      queueMicrotask(callback);
    },
  });
  const result = await mapInSlices([3, 1, 4], (value, index) => {
    visited.push(index);
    now += 5;
    return [value, index, -0];
  });
  assert.deepEqual(turns, [[0], [0, 1]]);
  assert.deepEqual(result, [
    [3, 0, -0],
    [1, 1, -0],
    [4, 2, -0],
  ]);
});

test('empty construction does no work and a failed item stops later construction', async () => {
  assert.deepEqual(await mapInSlices([], () => assert.fail()), []);
  const visited = [];
  await assert.rejects(
    mapInSlices([1, 2, 3], (value) => {
      visited.push(value);
      if (value === 2) throw new Error('invalid mesh');
      return value;
    }),
    /invalid mesh/,
  );
  assert.deepEqual(visited, [1, 2]);
});
