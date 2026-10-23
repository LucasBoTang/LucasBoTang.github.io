import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { whenFigureReady } from '../../src/lib/figure-ready.ts';
import { installGlobals } from '../helpers/browser.mjs';

function host(t, embedded = true) {
  const { document, MutationObserver } = parseHTML(
    '<html data-opening-pending><body><div class="screen-reveal" data-screen-reveal><iframe></iframe></div></body></html>',
  );
  const values = {
    window: { frameElement: embedded ? document.querySelector('iframe') : null },
    MutationObserver,
  };
  installGlobals(t, values);
  return { page: document.documentElement, screen: document.querySelector('.screen-reveal') };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('embedded playback waits for both page preparation and its own screen to finish', async (t) => {
  const { page, screen } = host(t);
  let starts = 0;
  whenFigureReady(() => starts++);
  screen.setAttribute('data-screen-pending', '');
  page.removeAttribute('data-opening-pending');
  await flush();
  assert.equal(starts, 0, 'lifting the page gate must not run a still-hidden figure');
  screen.removeAttribute('data-screen-pending');
  await flush();
  assert.equal(starts, 1);
  screen.setAttribute('data-screen-pending', '');
  screen.removeAttribute('data-screen-pending');
  await flush();
  assert.equal(starts, 1, 'a released figure is never initialized twice');
});

test('the page fallback releases a child if no screen entrance was prepared', async (t) => {
  const { page } = host(t);
  let starts = 0;
  whenFigureReady(() => starts++);
  page.removeAttribute('data-opening-pending');
  await flush();
  assert.equal(starts, 1);
});

test('late-loading children start immediately after their host has settled', (t) => {
  const { page } = host(t);
  page.removeAttribute('data-opening-pending');
  let starts = 0;
  whenFigureReady(() => starts++);
  assert.equal(starts, 1);
});

test('standalone figures do not wait for a parent entrance', (t) => {
  host(t, false);
  let starts = 0;
  whenFigureReady(() => starts++);
  assert.equal(starts, 1);
});

test('home previews keep the first frame still until the wordmark handover finishes', async (t) => {
  const { page, screen } = host(t);
  page.removeAttribute('data-opening-pending');
  screen.className = '';
  screen.setAttribute('data-figure-preview', '');
  screen.setAttribute('data-preview-pending', '');
  let starts = 0;
  whenFigureReady(() => starts++);
  assert.equal(starts, 0);
  screen.removeAttribute('data-preview-pending');
  await flush();
  assert.equal(starts, 1);
});
