import { announceArrival, arrival, arrivalFrames, createArrivalQueue } from '../../../lib/arrival';
import { phonePace } from '../../../lib/breakpoints';
import { enhance } from '../../../lib/lifecycle';
import { onKeyboardFocus, reducedMotionQuery } from '../../../lib/motion';
import { liftOpeningGate, openingPending } from '../../../lib/opening-gate';
import { waitForPageReady } from '../../../lib/page-ready';
import { createTimeline } from '../../../lib/timeline';
import { addHeroOpening } from '../HomeHero/hero-opening';
import { addLaneOpening } from '../ResearchNavigator/lane-opening';
import { openingEvents, openingTiming as time, part, type HomeOpeningGroup } from './opening';

// Sequences the home opening, then reveals the page hidden by SiteLayout's `opening`. The hero and
// the research lanes define their own animations; this file decides when they run, and brings in
// the reading units that follow them.

/** Scrolling this share of a screen down counts as moving on from the opening. */
const SCROLLED_ON = 0.25;

function setupHomeOpening(page: HTMLElement) {
  const reducedMotion = reducedMotionQuery();
  const heroElement = page.querySelector<HTMLElement>('[data-home-motion]');
  // If the gate has already timed out, the page is showing: leave it as it is.
  if (reducedMotion.matches || !Element.prototype.animate || !heroElement || !openingPending()) {
    liftOpeningGate();
    return;
  }
  const timeline = createTimeline<HomeOpeningGroup>();
  // Whatever goes wrong, the page ends up whole: a failing step skips the rest of the opening.
  const safely = (step: () => void) => {
    try {
      step();
    } catch {
      skipOpening();
    }
  };
  const hero = addHeroOpening(timeline, heroElement);
  timeline.appear(
    document.querySelector('.site-header'),
    time.frameAt,
    'identity',
    time.headerFade,
  );
  const navigator = page.querySelector<HTMLElement>(part('topics'));
  const lanes = navigator ? addLaneOpening(timeline, navigator) : undefined;

  // Reading units arrive whole, with no nested fades, clipped lines or separately timed links, one
  // at a time through the arrival queue as each comes on screen.
  const readingPace = phonePace();
  const nextArrival = createArrivalQueue();
  const readingUnits: [Element, HomeOpeningGroup][] = [];
  const readingUnit = (element: Element | null, group: HomeOpeningGroup) => {
    if (!element) return;
    timeline.animate(
      element,
      arrivalFrames(element),
      { duration: arrival.duration * readingPace, easing: arrival.easing },
      group,
    );
    readingUnits.push([element, group]);
  };
  readingUnit(page.querySelector(part('work-heading')), 'work');
  page
    .querySelectorAll(part('work-entry'))
    .forEach((entry, i) => readingUnit(entry, `work-entry-${i}`));
  readingUnit(page.querySelector(part('work-navigation')), 'work-navigation');
  readingUnit(page.querySelector(part('about')), 'about');
  readingUnit(document.querySelector('.site-footer'), 'footer');

  const revealActions = () => timeline.start('actions');
  let reading = false;
  const startReading = () => {
    if (timeline.finished || reading) return;
    reading = true;
    window.removeEventListener('scroll', onScroll);
    // A unit already scrolled past starts at once, so units in view never wait behind it. Units on
    // screen now are called back at once, and keep the beat; later ones may be hurried.
    let firstScreen = true;
    for (const [element, group] of readingUnits) {
      const arrive = () => {
        timeline.start(group);
        announceArrival(element);
      };
      timeline.whenVisible(element, () => {
        if (element.getBoundingClientRect().bottom <= 0) arrive();
        else timeline.later(arrive, nextArrival(firstScreen));
      });
    }
    firstScreen = false;
  };
  // A visitor who scrolls on past the hero has moved on from the opening: what they scroll to
  // arrives at once instead of waiting for the lanes.
  const onScroll = () => {
    if (window.scrollY > window.innerHeight * SCROLLED_ON) startReading();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  // The call to action arrives as the introduction starts to type, or at once if it is shown whole.
  heroElement.addEventListener(openingEvents.introStart, revealActions, { once: true });
  heroElement.addEventListener(openingEvents.introComplete, revealActions, { once: true });
  const startOpening = () => {
    if (timeline.finished || !page.isConnected) return;
    if (!openingPending()) return skipOpening();
    hero.start();
    timeline.start('identity');
    // The introduction starts typing as the research lanes open, whatever the portrait is doing,
    // and the reading units below follow once the lanes are fully open: the right column reads
    // from the top, then the page continues down.
    if (lanes) lanes.start(hero.startTyping, startReading);
    else {
      heroElement.addEventListener(openingEvents.introStart, startReading, { once: true });
      hero.startTyping();
    }
    hero.scheduleEnd();
    // The visitor may already have scrolled while resources were loading.
    onScroll();
    liftOpeningGate();
  };
  const skipOpening = () => {
    timeline.finish();
    window.removeEventListener('scroll', onScroll);
    lanes?.skip();
    hero.skip();
    liftOpeningGate();
  };
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) skipOpening();
  });
  onKeyboardFocus(skipOpening);
  void Promise.race([
    hero.ready,
    new Promise<void>((resolve) => window.setTimeout(resolve, time.readyTimeout)),
  ]).then(() => {
    // Let the browser paint after the pixel preparation, then start every opening clock together.
    requestAnimationFrame(() => requestAnimationFrame(() => safely(startOpening)));
  });
}

enhance('[data-opening-content]', (page) => {
  void waitForPageReady().then(() => setupHomeOpening(page));
});
