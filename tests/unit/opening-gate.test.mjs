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

test('the body waits for held work', async (t) => {
  const { holdBody, bodyReleased } = await gate(t);
  let finish;
  holdBody(new Promise((resolve) => (finish = resolve)));
  let released = false;
  void bodyReleased().then(() => (released = true));
  t.mock.timers.tick(500);
  await flush();
  assert.equal(released, false);
  finish();
  await flush();
  assert.ok(released);
});

test('held work keeps the body back no later than its bound after navigation', async (t) => {
  const { holdBody, bodyReleased, BODY_HOLD_UNTIL } = await gate(t, 1500);
  holdBody(new Promise(() => {}));
  let released = false;
  void bodyReleased().then(() => (released = true));
  t.mock.timers.tick(BODY_HOLD_UNTIL - 1500 - 1);
  await flush();
  assert.equal(released, false);
  t.mock.timers.tick(1);
  await flush();
  assert.ok(released);
});

test('with nothing held the body goes on at once', async (t) => {
  const { bodyReleased } = await gate(t);
  let released = false;
  void bodyReleased().then(() => (released = true));
  await flush();
  assert.ok(released);
});
