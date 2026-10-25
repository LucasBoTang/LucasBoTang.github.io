import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import {
  preparePicture,
  preparePoster,
} from '../../src/components/catalogue/ScreenReveal/picture-ready.ts';
import { frameQueue, installGlobals } from '../helpers/browser.mjs';

const flush = () => new Promise((resolve) => setImmediate(resolve));

function picture(t, ready = true) {
  const frames = frameQueue();
  installGlobals(t, { requestAnimationFrame: frames.request, cancelAnimationFrame: frames.cancel });
  const { document, Event } = parseHTML('<html><body></body></html>');
  const frame = document.createElement('iframe');
  const fonts = Promise.withResolvers();
  const image = Promise.withResolvers();
  const page = {
    URL: '/figures/example/',
    readyState: 'complete',
    fonts: { ready: fonts.promise },
    images: [{ decode: () => image.promise }],
  };
  frame.contentDocument = ready ? page : { URL: 'about:blank', readyState: 'complete' };
  let settled = false;
  const preparation = preparePicture(frame);
  const done = preparation.ready.then(() => {
    settled = true;
  });
  return {
    frame,
    page,
    fonts,
    image,
    cancel: preparation.cancel,
    frames,
    done,
    Event,
    settled: () => settled,
  };
}

test('a picture waits for its resources and two paint frames', async (t) => {
  const p = picture(t);
  p.fonts.resolve();
  await flush();
  assert.equal(p.frames.pending.size, 0);
  p.image.resolve();
  await flush();
  assert.equal(p.settled(), false);
  p.frames.flush();
  assert.equal(p.settled(), false);
  p.frames.flush();
  await p.done;
  assert.deepEqual([p.frame.onload, p.frame.onerror], [null, null]);
});

test('about:blank cannot spend a picture entrance before the actual document loads', async (t) => {
  const p = picture(t, false);
  p.frame.dispatchEvent(new p.Event('load'));
  await flush();
  assert.equal(p.settled(), false);
  p.frame.contentDocument = p.page;
  p.frame.dispatchEvent(new p.Event('load'));
  p.fonts.resolve();
  p.image.resolve();
  await flush();
  p.frames.flush();
  p.frames.flush();
  await p.done;
  assert.deepEqual([p.frame.onload, p.frame.onerror], [null, null]);
});

test('cancelling a waiting document removes its listeners and ignores a late load', async (t) => {
  const p = picture(t, false);
  p.cancel();
  await flush();
  assert.equal(p.settled(), true);
  assert.deepEqual([p.frame.onload, p.frame.onerror], [null, null]);
  p.frame.contentDocument = p.page;
  p.frame.dispatchEvent(new p.Event('load'));
  p.fonts.resolve();
  p.image.resolve();
  await flush();
  assert.equal(p.frames.pending.size, 0);
});

test('cancelling resource preparation cannot schedule paint work when resources finish late', async (t) => {
  const p = picture(t);
  p.cancel();
  await flush();
  assert.equal(p.settled(), true);
  p.fonts.resolve();
  p.image.resolve();
  await flush();
  assert.equal(p.frames.pending.size, 0);
});

test('a failed embedded document releases the wait and its listeners', async (t) => {
  const p = picture(t, false);
  p.frame.dispatchEvent(new p.Event('error'));
  await flush();
  assert.equal(p.settled(), true);
  assert.deepEqual([p.frame.onload, p.frame.onerror], [null, null]);
});

test('a rejected image or font still yields a fitted fallback picture', async (t) => {
  const p = picture(t);
  p.fonts.reject(new Error('font unavailable'));
  p.image.reject(new Error('image unavailable'));
  await flush();
  p.frames.flush();
  p.frames.flush();
  await p.done;
});

test('cancelling between paint frames removes the remaining paint work', async (t) => {
  const p = picture(t);
  p.fonts.resolve();
  p.image.resolve();
  await flush();
  p.frames.flush();
  assert.equal(p.frames.pending.size, 1);
  p.cancel();
  await p.done;
  assert.equal(p.frames.pending.size, 0);
  assert.deepEqual([p.frame.onload, p.frame.onerror], [null, null]);
});

test('a stalled poster decode can be released without waiting on its network request', async () => {
  const decode = Promise.withResolvers();
  const preparation = preparePoster({ decode: () => decode.promise });
  let ready = false;
  preparation.ready.then(() => {
    ready = true;
  });
  await flush();
  assert.equal(ready, false);
  preparation.cancel();
  await preparation.ready;
  assert.equal(ready, true);
  decode.reject(new Error('late image failure'));
  await flush();
});

test('a live figure can release a poster whose image is still decoding', async (t) => {
  const { document, MutationObserver } = parseHTML('<html><body><div></div></body></html>');
  installGlobals(t, { MutationObserver });
  const decode = Promise.withResolvers();
  const host = document.querySelector('div');
  const preparation = preparePoster({ decode: () => decode.promise }, host);
  let ready = false;
  preparation.ready.then(() => {
    ready = true;
  });
  await flush();
  assert.equal(ready, false);
  host.setAttribute('data-figure-live', '');
  await flush();
  assert.equal(ready, true);
  decode.reject(new Error('late poster failure'));
  await flush();
});
