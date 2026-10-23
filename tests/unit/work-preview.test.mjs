import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';

let instance = 0;
async function preview(t, reduced = false) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, MutationObserver, Event } = parseHTML(`
    <html><body><article data-project-host>
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
    emit,
    tick: (ms) => t.mock.timers.tick(ms),
    frame: () => link.querySelector('iframe'),
  };
}

test('brief pointer passes do not load a figure; a deliberate hover holds playback until revealed', async (t) => {
  const p = await preview(t);
  assert.equal(p.frame(), null);
  p.emit(p.host, 'pointerenter', { pointerType: 'mouse' });
  p.tick(200);
  p.emit(p.host, 'pointerleave', { pointerType: 'mouse' });
  p.tick(1000);
  assert.equal(p.frame(), null);
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
  assert.equal(p.frame(), null);
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
  const p = await preview(t, true);
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
