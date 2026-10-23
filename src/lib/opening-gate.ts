// SiteLayout's opening gate. A page with an opening starts with `data-opening-pending` on the root
// element, which keeps its content hidden (src/styles/motion.css) until the page's opening script
// lifts it, or until 3.5 seconds have passed.

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

/** An opening waits for held work no later than this long after navigation, which leaves time
 * before SiteLayout's 3.5s fallback to prepare its motion (home-opening.ts, reveal.ts). On a host
 * 300ms away, a first visit's figure documents take most of it to arrive and be drawn. */
export const OPENING_HOLD_UNTIL = 3000;
const openingHolds = new Set<Promise<unknown>>();
let releasedAt = 0;

/** Keeps an opening's motion back while `task` runs: its first typing waits behind a blinking
 * caret, and everything after follows from there. Work that would stall motion, such as drawing
 * the figures ahead (FigureWarmup), happens while the page is still. */
export function holdOpening(task: Promise<unknown>): void {
  openingHolds.add(task);
  const release = () => {
    openingHolds.delete(task);
    if (!openingHolds.size) releasedAt = performance.now();
  };
  void task.then(release, release);
}

let scanned = false;
/** Scripts arrive in no fixed order, so one that may hold the opening marks its element
 * `data-opening-hold` in the page itself; the opening is held until it removes the mark, having
 * decided, rather than going on because that script has not yet run. */
function holdForUndecided() {
  if (scanned) return;
  scanned = true;
  for (const element of document.querySelectorAll('[data-opening-hold]'))
    holdOpening(
      new Promise<void>((resolve) => {
        const observer = new MutationObserver(() => {
          if (element.hasAttribute('data-opening-hold')) return;
          observer.disconnect();
          resolve();
        });
        observer.observe(element, { attributes: true, attributeFilter: ['data-opening-hold'] });
      }),
    );
}

/** Whether an opening is still held back: some held work is running, and its bound is ahead. */
export const openingHeld = () => {
  holdForUndecided();
  return openingHolds.size > 0 && performance.now() < OPENING_HOLD_UNTIL;
};

/** When the opening was let go after being held, or 0 if nothing held it. */
export const openingReleasedAt = () =>
  openingHolds.size ? Math.min(performance.now(), OPENING_HOLD_UNTIL) : releasedAt;

/** Resolves once no held work is left, or at `OPENING_HOLD_UNTIL`. */
export async function openingReleased(): Promise<void> {
  if (!openingHeld()) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, Math.max(0, OPENING_HOLD_UNTIL - performance.now()));
  });
  while (openingHeld()) {
    if ((await Promise.race([Promise.allSettled([...openingHolds]), bound])) === undefined) break;
  }
  clearTimeout(timer);
}
