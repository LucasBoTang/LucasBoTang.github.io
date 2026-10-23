import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';

let instance = 0;
async function preview(t, { reduced = false, booting = false } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, MutationObserver, Event } = parseHTML(`
    <html${booting ? ' data-opening-pending' : ''}><body>
    <div data-home-motion${booting ? ' data-opening' : ''}></div><article data-project-host>
      <a data-figure-preview data-preview-src="/figures/learning-integers/"
        data-preview-width="588" data-preview-height="539" href="/research/#bo-l2o-study">
        <span class="work-preview-picture"></span>
      </a>
    </article></body></html>`);
  const host = document.querySelector('article');
  const link = document.querySelector('a');
  host.matches = () => false;
  Object.defineProperties(link, { clientWidth: { value: 320 }, clientHeight: { value: 160 } });
  const values = {
    document,
    MutationObserver,
    window: { setTimeout, IntersectionObserver: undefined },
    matchMedia: () => Object.assign(new EventTarget(), { matches: reduced }),
    ResizeObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        this.callback();
      }
    },
    IntersectionObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe(target) {
        this.callback([{ target, isIntersecting: true, intersectionRatio: 1 }]);
      }
    },
  };
  for (const [key, value] of Object.entries(values)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() =>
      descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key],
    );
  }
  await import(`../../src/components/home/work-preview.ts?test=${++instance}`);
  const emit = (target, name, properties = {}) => {
    const event = Object.assign(new Event(name, { cancelable: true }), properties);
    target.dispatchEvent(event);
    return event;
  };
  return {
    host,
    link,
    page: document.documentElement,
    hero: document.querySelector('[data-home-motion]'),
    emit,
    tick: (ms) => t.mock.timers.tick(ms),
    frame: () => link.querySelector('iframe'),
  };
}

test('brief pointer passes do not load a figure; a deliberate hover holds playback until revealed', async (t) => {
  const p = await preview(t);
  assert.equal(Boolean(p.frame()), false);
  p.emit(p.host, 'pointerenter', { pointerType: 'mouse' });
  p.tick(200);
  p.emit(p.host, 'pointerleave', { pointerType: 'mouse' });
  p.tick(1000);
  assert.equal(Boolean(p.frame()), false);
  p.emit(p.host, 'pointerenter', { pointerType: 'mouse' });
  p.tick(240);
  assert.ok(p.frame());
  assert.ok(p.link.hasAttribute('data-preview-pending'));
  p.emit(p.frame(), 'load');
  assert.ok(p.link.hasAttribute('data-preview-visible'));
  p.tick(1339);
  assert.ok(p.link.hasAttribute('data-preview-pending'));
  p.tick(1);
  assert.equal(p.link.hasAttribute('data-preview-pending'), false);
});

test('departing releases the iframe and ignores a stale load event', async (t) => {
  const p = await preview(t);
  p.emit(p.host, 'pointerenter', { pointerType: 'mouse' });
  p.tick(240);
  const oldFrame = p.frame();
  p.emit(p.host, 'pointerleave', { pointerType: 'mouse' });
  p.tick(999);
  assert.ok(p.frame() === oldFrame);
  p.tick(1);
  assert.equal(Boolean(p.frame()), false);
  p.emit(oldFrame, 'load');
  assert.equal(p.link.hasAttribute('data-preview-visible'), false);
});

test('re-entering during the exit keeps the current document instead of flashing blank', async (t) => {
  const p = await preview(t);
  p.emit(p.host, 'pointerenter', { pointerType: 'mouse' });
  p.tick(240);
  const frame = p.frame();
  p.emit(frame, 'load');
  p.tick(1340);
  p.emit(p.host, 'pointerleave', { pointerType: 'mouse' });
  p.tick(100);
  p.emit(p.host, 'pointerenter', { pointerType: 'mouse' });
  assert.equal(p.frame(), frame);
  assert.ok(p.link.hasAttribute('data-preview-visible'));
});

test('the first touch opens a preview; the next touch and keyboard activation follow the link', async (t) => {
  const p = await preview(t);
  p.emit(p.link, 'pointerdown', { pointerType: 'touch' });
  assert.ok(p.emit(p.link, 'click', { detail: 1 }).defaultPrevented);
  p.tick(240);
  p.emit(p.frame(), 'load');
  p.tick(1340);
  p.emit(p.link, 'pointerdown', { pointerType: 'touch' });
  assert.equal(p.emit(p.link, 'click', { detail: 1 }).defaultPrevented, false);
  assert.equal(p.emit(p.link, 'click', { detail: 0 }).defaultPrevented, false);
});

test('reduced motion removes the handover delay', async (t) => {
  const p = await preview(t, { reduced: true });
  p.emit(p.host, 'pointerenter', { pointerType: 'mouse' });
  p.tick(0);
  p.emit(p.frame(), 'load');
  p.tick(0);
  assert.ok(p.link.hasAttribute('data-preview-visible'));
  assert.equal(p.link.hasAttribute('data-preview-pending'), false);
});

test('returning while the document loads reveals that document as soon as it is ready', async (t) => {
  const p = await preview(t);
  p.emit(p.host, 'pointerenter', { pointerType: 'mouse' });
  p.tick(240);
  const frame = p.frame();
  p.emit(p.host, 'pointerleave', { pointerType: 'mouse' });
  p.tick(100);
  p.emit(p.host, 'pointerenter', { pointerType: 'mouse' });
  p.emit(frame, 'load');
  assert.ok(p.frame() === frame);
  assert.ok(p.link.hasAttribute('data-preview-visible'));
});

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('home previews wait for the boot animation, including after the page first becomes visible', async (t) => {
  const p = await preview(t, { booting: true });
  p.emit(p.host, 'pointerenter', { pointerType: 'mouse' });
  p.tick(3000);
  assert.equal(Boolean(p.frame()), false, 'the opening must finish before the preview loads');
  p.page.removeAttribute('data-opening-pending');
  await flush();
  p.tick(3000);
  assert.equal(Boolean(p.frame()), false, 'the first visible frame is not the end of the boot');
  p.hero.removeAttribute('data-opening');
  await flush();
  p.tick(400);
  p.tick(239);
  assert.equal(Boolean(p.frame()), false, 'the wordmark must remain readable before loading');
  p.tick(1);
  assert.ok(p.frame());
  p.emit(p.frame(), 'load');
  assert.ok(p.link.hasAttribute('data-preview-visible'));
  assert.ok(p.link.hasAttribute('data-preview-pending'));
  p.tick(1340);
  assert.equal(p.link.hasAttribute('data-preview-pending'), false);
});

test('a pointer that leaves during boot does not open a delayed preview', async (t) => {
  const p = await preview(t, { booting: true });
  p.emit(p.host, 'pointerenter', { pointerType: 'mouse' });
  p.tick(100);
  p.emit(p.host, 'pointerleave', { pointerType: 'mouse' });
  p.page.removeAttribute('data-opening-pending');
  p.hero.removeAttribute('data-opening');
  await flush();
  p.tick(3000);
  assert.equal(Boolean(p.frame()), false);
  assert.equal(p.link.hasAttribute('data-preview-visible'), false);
});

test('touch focus waits for boot and opens once the opening is completed or skipped', async (t) => {
  const p = await preview(t, { booting: true });
  p.emit(p.link, 'pointerdown', { pointerType: 'touch' });
  p.emit(p.link, 'click', { detail: 1 });
  await flush();
  p.tick(3000);
  assert.equal(Boolean(p.frame()), false);
  p.hero.removeAttribute('data-opening');
  p.page.removeAttribute('data-opening-pending');
  await flush();
  p.tick(400);
  p.tick(240);
  assert.ok(p.frame());
});

test('the wordmark gets a readable pause after its row finishes arriving', async (t) => {
  const p = await preview(t, { booting: true });
  let finishArrival;
  const finished = new Promise((resolve) => {
    finishArrival = resolve;
  });
  p.host.getAnimations = () => [{ finished }];
  p.emit(p.host, 'pointerenter', { pointerType: 'mouse' });
  p.page.removeAttribute('data-opening-pending');
  p.hero.removeAttribute('data-opening');
  await flush();
  p.tick(5000);
  assert.equal(Boolean(p.frame()), false, 'the row is still arriving');
  finishArrival();
  await flush();
  p.tick(399);
  assert.equal(Boolean(p.frame()), false, 'keep the settled wordmark readable');
  p.tick(1);
  p.tick(239);
  assert.equal(Boolean(p.frame()), false);
  p.tick(1);
  assert.ok(p.frame());
});
