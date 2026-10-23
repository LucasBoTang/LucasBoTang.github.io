import { frameQueue, installGlobals, intersectionObservers, mediaQuery } from './browser.mjs';

/** Deterministic frames, visibility and motion preferences for animation unit tests. */
export function animationBrowser(t) {
  const motion = mediaQuery();
  const document = new EventTarget();
  document.hidden = false;
  const queue = frameQueue();
  const frames = queue.pending;
  const observers = intersectionObservers();
  const browser = {
    document,
    matchMedia: () => motion,
    requestAnimationFrame: queue.request,
    cancelAnimationFrame: queue.cancel,
    IntersectionObserver: observers.Observer,
  };
  installGlobals(t, { ...browser, window: browser });
  return {
    browser,
    motion,
    document,
    frames,
    visible: observers.deliver,
    frame: queue.flush,
    get disconnected() {
      return observers.instances.every((observer) => observer.targets.size === 0);
    },
  };
}
