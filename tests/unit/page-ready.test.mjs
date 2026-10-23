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

test('fonts that never arrive skip the opening at the bound', async (t) => {
  const { document, waitForPageReady } = await page(t);
  document.fonts = { ready: new Promise(() => {}) };
  let ready = false;
  void waitForPageReady().then(() => (ready = true));
  t.mock.timers.tick(1800);
  await flush();
  assert.ok(ready);
  assert.equal(document.documentElement.hasAttribute('data-opening-pending'), false);
});
