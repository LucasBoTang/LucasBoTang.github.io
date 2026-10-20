import { announceArrival, arrival, arrivalFrames, createArrivalQueue } from './arrival';
import { phonePace } from './breakpoints';
import { enhance } from './lifecycle';
import { onKeyboardFocus, reducedMotionQuery } from './motion';
import { liftOpeningGate, openingPending } from './opening-gate';
import { waitForPageReady } from './page-ready';

// Inner-page opening: the element marked `data-reveal="title"` wipes in, then the `lead` and each
// `unit` arrive (see arrival.ts) as they enter the viewport, in document order, through the page's
// arrival queue. The footer arrives last. Arriving from another page, the title is already in
// place, being rewritten (PageHeader), and the first unit rises sooner, while the last page is
// still leaving above it, so the two pages hand over without a gap.

/** The title wipes in from the top. */
const TITLE_WIPE: Keyframe[] = [
  { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
  { opacity: 1, clipPath: 'inset(0 0 0% 0)' },
];
const TITLE_DURATION = 1000;
/** Arriving from another page, the first unit starts this long after the page shows. */
const HAND_OVER = 120;

function setupReveal(page: HTMLElement) {
  const reducedMotion = reducedMotionQuery();
  // If the gate has already timed out, the page is showing: leave it as it is.
  if (reducedMotion.matches || !Element.prototype.animate || !openingPending()) {
    liftOpeningGate();
    return;
  }
  const animations = new Map<Element, Animation>();
  const pending = new Map<Element, Animation>();
  const pace = phonePace();
  const title = page.querySelector('[data-reveal="title"]');
  const handedOver = title?.hasAttribute('data-title-from') ?? false;
  const nextArrival = createArrivalQueue(handedOver ? HAND_OVER : 0);

  /** Starts `element`'s arrival: in its turn if it is on screen, at once if already scrolled past,
   * so units in view are never kept waiting behind ones the reader has left. */
  const play = (element: Element, firstScreen = false, box = element.getBoundingClientRect()) => {
    const animation = pending.get(element);
    if (!animation) return;
    pending.delete(element);
    observer.unobserve(element);
    const scrolledPast = box.bottom <= 0;
    const delay = scrolledPast ? 0 : nextArrival(firstScreen);
    animation.effect?.updateTiming({ delay });
    animation.play();
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
    { threshold: 0, rootMargin: '100000px 0px -16px 0px' },
  );

  /** Prepares `element`, last measured at `box`, to arrive: now if the reader has reached it (it is
   * on screen, or already scrolled past), or once they do. */
  const prepare = (element: Element, box: DOMRect, frames: Keyframe[], duration: number) => {
    const animation = element.animate(frames, {
      duration: duration * pace,
      easing: arrival.easing,
      fill: 'both',
    });
    animation.pause();
    animations.set(element, animation);
    pending.set(element, animation);
    animation.onfinish = () => {
      animation.cancel();
      animations.delete(element);
    };
    if (box.top < innerHeight) play(element, true, box);
    else observer.observe(element);
  };

  // Every unit is measured before any is prepared: measuring between preparations would make the
  // browser work out the page's style again for each unit.
  const units = [
    ...page.querySelectorAll('[data-reveal="lead"]'),
    ...page.querySelectorAll('[data-reveal="unit"]'),
    ...document.querySelectorAll('.site-footer'),
  ];
  const wipesTitle = title && !handedOver;
  const titleBox = wipesTitle ? title.getBoundingClientRect() : undefined;
  const boxes = units.map((element) => element.getBoundingClientRect());
  if (wipesTitle && titleBox) prepare(title, titleBox, TITLE_WIPE, TITLE_DURATION);
  units.forEach((element, i) =>
    prepare(element, boxes[i], arrivalFrames(element), arrival.duration),
  );

  const finish = () => {
    observer.disconnect();
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    pending.clear();
    liftOpeningGate();
  };
  // Moving focus by keyboard, anywhere on the page, shows everything at once.
  onKeyboardFocus(finish);
  reducedMotion.addEventListener('change', finish);
  liftOpeningGate();
}

enhance('[data-reveal-root]', (page) => {
  void waitForPageReady().then(() => setupReveal(page));
});
