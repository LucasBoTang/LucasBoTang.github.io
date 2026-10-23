import {
  ARRIVAL_PREPARE_EVENT,
  announceArrival,
  arrival,
  arrivalFrames,
  createArrivalQueue,
} from './arrival';
import { phonePace } from './breakpoints';
import { enhance } from './lifecycle';
import { onKeyboardFocus, reducedMotionQuery } from './motion';
import {
  liftOpeningGate,
  openingPending,
  openingReleased,
  openingReleasedAt,
} from './opening-gate';
import { waitForPageReady } from './page-ready';

// Inner-page body opening: PageHeader starts the title and introduction together. The remaining
// leads and units arrive (see arrival.ts) through one queue after a short reading pause, without
// waiting for the introduction to finish typing. Work that holds the opening back
// (opening-gate.ts `holdOpening`) holds the introduction's typing too, so the pause is measured
// from its release. The footer arrives last.

/** One reading beat from the introduction's start, overlapping resource preparation. */
const READING_BEAT = 600;
/** Only the first visible blurred units receive temporary compositor hints. */
const WARM_UNIT_LIMIT = 2;

function setupReveal(page: HTMLElement) {
  const reducedMotion = reducedMotionQuery();
  // If the gate has already timed out, the page is showing: leave it as it is.
  if (reducedMotion.matches || !Element.prototype.animate || !openingPending()) {
    liftOpeningGate();
    return;
  }
  const animations = new Map<Element, Animation[]>();
  const pace = phonePace();
  const intro = page.querySelector<HTMLElement>('[data-page-intro]');
  const now = performance.now();
  const introAt = Math.max(Number(intro?.dataset.introStarted ?? now), openingReleasedAt());
  const firstDelay = intro ? Math.max(0, introAt + READING_BEAT - now) : 0;
  const nextArrival = createArrivalQueue(firstDelay);
  let warmed = 0;

  /** Releases both the finished animation and its temporary compositor hint. */
  const release = (element: Element) => {
    animations.get(element)?.forEach((animation) => animation.cancel());
    element.removeAttribute('data-arrival-warm');
    animations.delete(element);
  };

  /** Starts `element`'s arrival: in its turn if it is on screen, at once if already scrolled past,
   * so units in view are never kept waiting behind ones the reader has left. */
  const play = (element: Element, firstScreen = false, box = element.getBoundingClientRect()) => {
    const group = animations.get(element);
    if (!group || group[0].playState !== 'paused') return;
    observer.unobserve(element);
    const scrolledPast = box.bottom <= 0;
    const delay = scrolledPast
      ? 0
      : nextArrival(firstScreen, Number(element.getAttribute('data-arrival-hold') ?? 0));
    group.forEach((animation) => {
      animation.effect?.updateTiming({ delay });
      animation.play();
    });
    announceArrival(element, delay);
  };
  // Units scrolled into view together queue in document order. The watched area reaches up without
  // end, so units a jump carried past without crossing the screen are caught as well.
  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
        .forEach((element) => play(element));
    },
    { rootMargin: '100000px 0px -16px 0px' },
  );

  /** Prepares `element`, last measured at `box`, to arrive: now if the reader has reached it (it is
   * on screen, or already scrolled past), or once they do. */
  const prepare = (element: Element, box: DOMRect, frames: Keyframe[]) => {
    const group = [
      element.animate(frames, {
        duration: arrival.duration * pace,
        easing: arrival.easing,
        fill: 'both',
      }),
    ];
    // A component may replace the default presentation while retaining the shared clock.
    element.dispatchEvent(new CustomEvent(ARRIVAL_PREPARE_EVENT, { detail: group }));
    group.forEach((animation) => animation.pause());
    animations.set(element, group);
    group[0].onfinish = () => release(element);
    // Use the introduction's reading pause to let Chrome prepare the first blurred text layers.
    // Keep this to two visible units; release each hint when it lands or the opening is skipped.
    if (
      group.length === 1 &&
      warmed < WARM_UNIT_LIMIT &&
      box.top < innerHeight &&
      box.bottom > 0 &&
      frames.some((frame) => frame.filter)
    ) {
      element.setAttribute('data-arrival-warm', '');
      warmed++;
    }
  };

  // Every unit is measured before any is prepared: measuring between preparations would make the
  // browser work out the page's style again for each unit.
  const units = [
    ...page.querySelectorAll('[data-reveal="lead"]:not([data-page-intro]), [data-reveal="unit"]'),
    ...document.querySelectorAll('[data-site-footer]'),
  ];
  const boxes = units.map((element) => element.getBoundingClientRect());
  units.forEach((element, i) => prepare(element, boxes[i], arrivalFrames(element)));

  const finish = () => {
    observer.disconnect();
    animations.forEach((_, element) => release(element));
    liftOpeningGate();
  };
  // Moving focus by keyboard, anywhere on the page, shows everything at once.
  onKeyboardFocus(finish);
  reducedMotion.addEventListener('change', finish);
  // Commit the paused first frames before starting the clocks, as the home opening does.
  // Keyboard focus, motion preferences or the layout fallback may release the gate meanwhile.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (!openingPending() || !page.isConnected) {
        finish();
        return;
      }
      units.forEach((element, i) => {
        if (boxes[i].top < innerHeight) play(element, true, boxes[i]);
        else observer.observe(element);
      });
      liftOpeningGate();
    }),
  );
}

enhance('[data-reveal-root]', (page) => {
  void waitForPageReady()
    .then(openingReleased)
    .then(() => setupReveal(page));
});
