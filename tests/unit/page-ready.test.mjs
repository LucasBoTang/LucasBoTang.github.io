import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { installGlobals, mediaQuery } from '../helpers/browser.mjs';
import { registerTypeScriptImports } from '../helpers/typescript-imports.mjs';

let instance = 0;

/** A page whose opening keeps it dark, with fake timers and page-ready loaded fresh. */
async function page(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document } = parseHTML('<html data-opening-pending><body></body></html>');
  document.fonts = { ready: Promise.resolve() };
  Object.defineProperty(document, 'images', { value: [] });
  installGlobals(t, {
    document,
    window: { setTimeout, clearTimeout },
    matchMedia: () => mediaQuery(false),
  });
  const hooks = registerTypeScriptImports();
  try {
    return {
      document,
      ...(await import(`../../src/lib/page-ready.ts?test=${++instance}`)),
    };
  } finally {
    hooks.deregister();
  }
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('a held task that outlasts the resource bound delays the opening without skipping it', async (t) => {
  const { document, holdPageReady, waitForPageReady } = await page(t);
  let release;
  holdPageReady(new Promise((resolve) => (release = resolve)));
  let ready = false;
  void waitForPageReady().then(() => (ready = true));
  await flush();
  t.mock.timers.tick(5000);
  await flush();
  assert.equal(ready, false, 'the opening waits for the task');
  assert.ok(document.documentElement.hasAttribute('data-opening-pending'), 'and is not skipped');
  release();
  await flush();
  t.mock.timers.tick(400);
  await flush();
  assert.ok(ready);
  assert.ok(
    document.documentElement.hasAttribute('data-opening-pending'),
    'the opening plays: its own script lifts the gate',
  );
});

test('resources settle while a held task runs, not after it', async (t) => {
  const { holdPageReady, waitForPageReady } = await page(t);
  let release;
  holdPageReady(new Promise((resolve) => (release = resolve)));
  let ready = false;
  void waitForPageReady().then(() => (ready = true));
  await flush();
  t.mock.timers.tick(300);
  release();
  await flush();
  assert.equal(ready, false, 'resources are still settling');
  t.mock.timers.tick(100);
  await flush();
  assert.ok(ready, 'ready once resources have settled, 400ms after they arrived');
});

test('resources that never arrive skip the opening at the bound', async (t) => {
  const { document, waitForPageReady } = await page(t);
  document.fonts = { ready: new Promise(() => {}) };
  let ready = false;
  void waitForPageReady().then(() => (ready = true));
  t.mock.timers.tick(1800);
  await flush();
  assert.ok(ready);
  assert.equal(document.documentElement.hasAttribute('data-opening-pending'), false);
});
