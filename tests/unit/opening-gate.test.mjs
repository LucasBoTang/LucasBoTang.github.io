import assert from 'node:assert/strict';
import test from 'node:test';
import { registerTypeScriptImports } from '../helpers/typescript-imports.mjs';

let instance = 0;

/** opening-gate loaded fresh, with fake timers and a clock at `now` milliseconds. */
async function gate(t, now = 0) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(performance, 'now', () => now);
  const hooks = registerTypeScriptImports();
  try {
    return await import(`../../src/lib/opening-gate.ts?test=${++instance}`);
  } finally {
    hooks.deregister();
  }
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('the opening waits for held work, and knows when it was let go', async (t) => {
  const { holdOpening, openingHeld, openingReleased, openingReleasedAt } = await gate(t, 300);
  let finish;
  holdOpening(new Promise((resolve) => (finish = resolve)));
  let released = false;
  void openingReleased().then(() => (released = true));
  t.mock.timers.tick(500);
  await flush();
  assert.equal(released, false);
  assert.ok(openingHeld());
  finish();
  await flush();
  assert.ok(released);
  assert.equal(openingHeld(), false);
  assert.equal(openingReleasedAt(), 300, 'released at the mocked clock');
});

test('held work keeps the opening back no later than its bound after navigation', async (t) => {
  const { holdOpening, openingReleased, OPENING_HOLD_UNTIL } = await gate(t, 1500);
  holdOpening(new Promise(() => {}));
  let released = false;
  void openingReleased().then(() => (released = true));
  t.mock.timers.tick(OPENING_HOLD_UNTIL - 1500 - 1);
  await flush();
  assert.equal(released, false);
  t.mock.timers.tick(1);
  await flush();
  assert.ok(released);
});

test('with nothing held the opening goes on at once', async (t) => {
  const { openingReleased } = await gate(t);
  let released = false;
  void openingReleased().then(() => (released = true));
  await flush();
  assert.ok(released);
});

test('failed preparation releases its hold without rejecting the opening or another task', async (t) => {
  const { holdOpening, openingHeld, openingReleased } = await gate(t);
  const pending = Promise.withResolvers();
  holdOpening(pending.promise);
  holdOpening(Promise.reject(new Error('preparation failed')));
  await flush();
  assert.equal(openingHeld(), true, 'the second task still owns its hold');
  pending.resolve();
  await openingReleased();
  await flush();
  assert.equal(openingHeld(), false);
});
