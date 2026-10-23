import { onKeyboardFocus, reducedMotionQuery } from './motion';
import { liftOpeningGate, openingPending } from './opening-gate';

/** Leave time inside the layout's 2.5s fallback for animation preparation. */
const RESOURCE_TIMEOUT = 1800;
/** A short quiet interval lets decoded images and loaded fonts settle before motion starts. */
const SETTLE_TIME = 400;
const readiness = new Map<boolean, Promise<void>>();
const holds = new Set<Promise<unknown>>();

/** Keeps the page's opening waiting for `task` too, within the same bound as its resources. */
export function holdPageReady(task: Promise<unknown>): void {
  holds.add(task);
}

/** Shared readiness for page openings: first-screen fonts and eager images, and whatever
 * `holdPageReady` adds, bounded on failure. */
export function waitForPageReady({ waitForImages = true } = {}): Promise<void> {
  if (!openingPending()) return Promise.resolve();
  const cached = readiness.get(waitForImages);
  if (cached) return cached;
  const ready = new Promise<void>((resolve) => {
    const reducedMotion = reducedMotionQuery();
    let timeout = 0;
    let settle = 0;
    let finished = false;
    const finish = (skip = false) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      window.clearTimeout(settle);
      stopKeyboardFocus();
      reducedMotion.removeEventListener('change', onPreferenceChange);
      // A font-only opening owns its gate when images prepare independently. An unrelated
      // image waiter's timeout must not cancel that opening during its settling interval.
      if (skip && (!waitForImages || !readiness.has(false))) liftOpeningGate();
      resolve();
    };
    const onPreferenceChange = () => {
      if (reducedMotion.matches) finish(true);
    };
    const stopKeyboardFocus = onKeyboardFocus(() => finish(true));
    reducedMotion.addEventListener('change', onPreferenceChange);
    if (reducedMotion.matches) {
      finish(true);
      return;
    }
    const images = [...document.images]
      .filter((image) => waitForImages && image.loading !== 'lazy')
      .map((image) => image.decode());
    const resources = Promise.allSettled([document.fonts.ready, ...images]);
    timeout = window.setTimeout(() => finish(true), RESOURCE_TIMEOUT);
    void resources.then(async () => {
      // Holds may be added while resources load, so wait until none are left pending.
      let awaited = 0;
      while (!finished && awaited < holds.size) {
        const pending = [...holds];
        awaited = pending.length;
        await Promise.allSettled(pending);
      }
      if (finished) return;
      window.clearTimeout(timeout);
      settle = window.setTimeout(() => finish(), SETTLE_TIME);
    });
  });
  readiness.set(waitForImages, ready);
  return ready;
}
