import assert from 'node:assert/strict';
import test from 'node:test';
import { installGlobals } from '../helpers/browser.mjs';
import { registerTypeScriptImports } from '../helpers/typescript-imports.mjs';

const hooks = registerTypeScriptImports();
let createArrivalQueue;
try {
  ({ createArrivalQueue } = await import('../../src/lib/arrival.ts'));
} finally {
  hooks.deregister();
}

test('a lane opening reserves its full duration before the next reading unit', (t) => {
  let now = 0;
  installGlobals(t, { performance: { now: () => now } });
  const next = createArrivalQueue(600);
  assert.equal(next(true, 1336), 600);
  assert.equal(next(true), 1936);
  assert.equal(next(true), 2456);
  now = 7000;
  assert.equal(next(false), 0);
});

test('an opening hold survives catch-up, while ordinary arrivals keep their original beat', (t) => {
  installGlobals(t, { performance: { now: () => 0 } });
  const held = createArrivalQueue();
  held(true, 3000);
  assert.equal(held(false), 3000);
  const ordinary = createArrivalQueue();
  assert.equal(ordinary(true), 0);
  assert.equal(ordinary(true), 520);
  assert.equal(ordinary(false), 1040);
});
