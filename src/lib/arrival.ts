import { isPhone } from './breakpoints';

// One queue spaces reading units as they arrive. `rise` enters from below; `cascade` enters
// from the right (below on phones); `wipe` reveals a heading from its left edge.

export const arrival = {
  /** How long a unit takes to arrive, in milliseconds. */
  duration: 1100,
  /** The least time between the starts of two units. */
  beat: 520,
  /** Units scrolled into view while others are still waiting more than `backlog` close up to
   * `catchUp` apart, and none waits more than `maxWait`, so a reader moving quickly is never kept
   * waiting. The first screen is never hurried: it keeps the beat however long it is. */
  backlog: 1200,
  catchUp: 200,
  maxWait: 2500,
  easing: 'cubic-bezier(.16,1,.3,1)',
  /** A plain fade, for what should appear without moving: gentler at the start than `easing`, so
   * it eases in rather than pops. */
  fadeEasing: 'cubic-bezier(.33,1,.68,1)',
};

/**
 * A queue of arrivals. Each call reserves the next start, at least a beat after the one before
 * and never in the past, and returns how long from now it is, in milliseconds. A unit on the
 * first screen is `patient`; one scrolled into view may be hurried to catch up. The first start
 * is at least `firstAt` from now.
 */
export function createArrivalQueue(firstAt = 0) {
  let lastStartAt = performance.now() + firstAt - arrival.beat;
  let reservedUntil = 0;
  return (patient: boolean, hold = 0) => {
    const now = performance.now();
    const hasBacklog = !patient && lastStartAt - now > arrival.backlog;
    const nextStartAt = Math.max(
      now,
      reservedUntil,
      lastStartAt + (hasBacklog ? arrival.catchUp : arrival.beat),
    );
    lastStartAt = patient
      ? nextStartAt
      : Math.max(reservedUntil, Math.min(nextStartAt, now + arrival.maxWait));
    reservedUntil = lastStartAt + hold;
    return lastStartAt - now;
  };
}

/** How far a rising unit starts below its place, and a cascading one to its right, in pixels. */
const RISE = 14;
const SHIFT = 24;
/** A moving unit also comes into focus from this blur, like a print sharpening as it develops. */
const SOFTEN = 'blur(3px)';

const rise: Keyframe[] = [
  { opacity: 0, transform: `translateY(${RISE}px)`, filter: SOFTEN },
  { opacity: 1, transform: 'none', filter: 'blur(0px)' },
];
const cascade: Keyframe[] = [
  { opacity: 0, transform: `translateX(${SHIFT}px)`, filter: SOFTEN },
  { opacity: 1, transform: 'none', filter: 'blur(0px)' },
];
const wipe: Keyframe[] = [
  { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
  { opacity: 1, offset: 0.3 },
  { opacity: 1, clipPath: 'inset(0 0% 0 0)' },
];

/** The keyframes for `element`'s arrival, chosen by its `data-arrival`. */
export function arrivalFrames(element: Element): Keyframe[] {
  switch (element.getAttribute('data-arrival')) {
    case 'cascade':
      return isPhone() ? rise : cascade;
    case 'wipe':
      return wipe;
    default:
      return rise;
  }
}

/** The event an element receives as its arrival is set going, with `detail.delay`, the
 * milliseconds until it starts to move, so what it holds can arrive in step with it. */
export const ARRIVAL_EVENT = 'arrival';
export const ARRIVAL_PREPARE_EVENT = 'arrival:prepare';

/** Tells `element` its arrival starts in `delay` milliseconds. */
export function announceArrival(element: Element, delay = 0) {
  element.dispatchEvent(new CustomEvent(ARRIVAL_EVENT, { detail: { delay } }));
}
