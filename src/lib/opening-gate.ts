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
