import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import {
  canPresentFigure,
  createFigureDrawReporter,
  hasFigureDrawn,
  whenFigureReady,
} from '../../src/lib/figure-ready.ts';
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

test('a figure drawn ahead in a warm-up slot starts at once, whatever its host is doing', (t) => {
  const { document, MutationObserver } = parseHTML(
    '<html data-opening-pending><body><div data-figure-warmup><iframe></iframe></div></body></html>',
  );
  installGlobals(t, {
    window: { frameElement: document.querySelector('iframe') },
    MutationObserver,
  });
  let starts = 0;
  whenFigureReady(() => starts++);
  assert.equal(starts, 1);
});

test('drawing readiness requires every declared renderer and is reported only once', () => {
  const { document } = parseHTML(
    '<html><body><div data-figure-drawn="pending"></div><div data-figure-drawn="pending"></div></body></html>',
  );
  const [first, second] = document.querySelectorAll('[data-figure-drawn]');
  const reportFirst = createFigureDrawReporter(first);
  assert.equal(hasFigureDrawn(null), false);
  assert.equal(hasFigureDrawn(document), false);
  reportFirst();
  assert.equal(hasFigureDrawn(document), false);
  createFigureDrawReporter(second)();
  assert.equal(hasFigureDrawn(document), true);
  first.setAttribute = () => assert.fail('a reported draw must not write on every frame');
  reportFirst();
  first.remove();
  second.remove();
  assert.equal(hasFigureDrawn(document), false);
});

test('fallbacks can be presented but cannot count as successful warm-up drawing', () => {
  const { document } = parseHTML(
    '<html><body><div data-figure-drawn="fallback"></div><div data-figure-drawn="pending"></div></body></html>',
  );
  assert.equal(canPresentFigure(null), false);
  assert.equal(canPresentFigure(document), false);
  document.querySelector('[data-figure-drawn="pending"]').setAttribute('data-figure-drawn', '');
  assert.equal(canPresentFigure(document), true);
  assert.equal(hasFigureDrawn(document), false);
  document.querySelector('[data-figure-drawn="fallback"]').setAttribute('data-figure-drawn', '');
  assert.equal(hasFigureDrawn(document), true);
});
