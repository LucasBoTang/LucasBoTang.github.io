import { onKeyboardFocus, reducedMotionQuery } from './motion';
import { liftOpeningGate, openingPending } from './opening-gate';

/** Leave time inside the layout's 2.5s fallback for animation preparation. */
const RESOURCE_TIMEOUT = 1800;
/** A short quiet interval lets decoded images and loaded fonts settle before motion starts. */
const SETTLE_TIME = 100;
let ready: Promise<void> | undefined;

/** Shared readiness for page openings: first-screen fonts and eager images, bounded on failure. */
export function waitForPageReady(): Promise<void> {
  if (!openingPending()) return Promise.resolve();
  ready ??= new Promise<void>((resolve) => {
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
      if (skip) liftOpeningGate();
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
      .filter((image) => image.loading !== 'lazy')
      .map((image) => image.decode());
    const resources = Promise.allSettled([document.fonts.ready, ...images]);
    timeout = window.setTimeout(() => finish(true), RESOURCE_TIMEOUT);
    void resources.then(() => {
      if (finished) return;
      window.clearTimeout(timeout);
      settle = window.setTimeout(() => finish(), SETTLE_TIME);
    });
  });
  return ready;
}
