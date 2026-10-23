// SiteLayout's opening gate. A page with an opening starts with `data-opening-pending` on the root
// element, which keeps its content hidden (src/styles/motion.css) until the page's opening script
// lifts it, or until 2.5 seconds have passed.

const PENDING = 'data-opening-pending';

/** Whether the gate is still up. */
export const openingPending = () => document.documentElement.hasAttribute(PENDING);

/** Lifts the gate, showing the page. */
export const liftOpeningGate = () => document.documentElement.removeAttribute(PENDING);

let visible: Promise<void> | undefined;

/** Resolves after the opening's first frames are committed, or the bounded fallback shows them. */
export function waitForOpeningVisible(): Promise<void> {
  if (!openingPending()) return Promise.resolve();
  visible ??= new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      if (openingPending()) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [PENDING] });
  });
  return visible;
}

/** An inner page's body waits for held work no later than this long after navigation, which
 * leaves time before SiteLayout's 2.5s fallback to prepare its arrival (reveal.ts). */
export const BODY_HOLD_UNTIL = 2000;
const bodyHolds = new Set<Promise<unknown>>();

/** Keeps an inner page's body back while `task` runs: the title and introduction already show
 * and type, so work that would stall the body's arrival happens behind the typing instead. */
export function holdBody(task: Promise<unknown>): void {
  bodyHolds.add(task);
}

/** Resolves once every held task has settled, or at `BODY_HOLD_UNTIL`. */
export function bodyReleased(): Promise<void> {
  return Promise.race([
    Promise.allSettled([...bodyHolds]).then(() => {}),
    new Promise<void>((resolve) =>
      setTimeout(resolve, Math.max(0, BODY_HOLD_UNTIL - performance.now())),
    ),
  ]);
}
