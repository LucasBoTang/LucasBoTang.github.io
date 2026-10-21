import { announceArrival, arrival, arrivalFrames, createArrivalQueue } from '../../../lib/arrival';
import { isPhone, phonePace } from '../../../lib/breakpoints';
import { enhance, onScrollFrame } from '../../../lib/lifecycle';
import { onKeyboardFocus, reducedMotionQuery } from '../../../lib/motion';
import { liftOpeningGate, openingPending } from '../../../lib/opening-gate';
import { waitForPageReady } from '../../../lib/page-ready';
import { createTimeline } from '../../../lib/timeline';
import { addHeroOpening } from '../HomeHero/hero-opening';
import { addLaneOpening } from '../ResearchNavigator/lane-opening';
import {
  isHomeReturn,
  openingEvents,
  openingTiming as time,
  part,
  skipHomeIntro,
  type HomeOpeningGroup,
} from './opening';

// Sequences the home opening, then reveals the page hidden by SiteLayout's `opening`. The hero and
// the research lanes define their own animations; this file decides when they run, and brings in
// the reading units that follow them.

/** Scrolling this share of a screen down counts as moving on from the opening. */
const SCROLLED_ON = 0.25;

function setupHomeOpening(page: HTMLElement) {
  const reducedMotion = reducedMotionQuery();
  const heroElement = page.querySelector<HTMLElement>('[data-home-motion]');
  // If animation is unavailable or the gate has already lifted, show complete prose immediately.
  if (reducedMotion.matches || !Element.prototype.animate || !heroElement || !openingPending()) {
    if (heroElement) skipHomeIntro(heroElement);
    liftOpeningGate();
    return;
  }
  const timeline = createTimeline<HomeOpeningGroup>();
  const returning = isHomeReturn();
  let readyTimeout = 0;
  // Whatever goes wrong, the page ends up whole: a failing step skips the rest of the opening.
  const safely = (step: () => void) => {
    try {
      step();
    } catch {
      skipOpening();
    }
  };
  const hero = addHeroOpening(timeline, heroElement);
  if (!returning) {
    timeline.appear(
      document.querySelector('.site-header'),
      time.frameAt,
      'identity',
      time.headerFade,
    );
  }
  const navigator = page.querySelector<HTMLElement>(part('topics'));
  const lanes = navigator ? addLaneOpening(timeline, navigator) : undefined;
  const bio = heroElement.querySelector<HTMLElement>('[data-home-bio] [data-typed-text]');

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
  readingUnit(page.querySelector(part('about')), 'about');
  readingUnit(document.querySelector('.site-footer'), 'footer');

  let introComplete = !returning && (bio?.hasAttribute('data-typing-complete') ?? false);
  let lanesComplete = false;
  let identityStarted = false;
  const revealActions = () => timeline.start('actions');
  const revealLanes = () => {
    if (lanes) lanes.start(revealActions, completeLanes);
    else {
      revealActions();
      completeLanes();
    }
  };
  let reading = false;
  const startReading = () => {
    if (timeline.finished || reading) return;
    reading = true;
    if (identityStarted) pageWatch.stop();
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
  const completeLanes = () => {
    lanesComplete = true;
    if (introComplete) startReading();
  };
  // A visitor who scrolls on past the hero has moved on from the opening: what they scroll to
  // arrives at once instead of waiting for the lanes.
  const onScroll = () => {
    if (!identityStarted && !openingPending() && isPhone()) safely(startIdentity);
    if (window.scrollY > window.innerHeight * SCROLLED_ON) startReading();
  };
  const pageWatch = onScrollFrame(onScroll);
  // The hero releases the lanes after the affiliation; the action joins their first light.
  // Reading below waits for the text and lanes to settle, unless the visitor scrolls on deliberately.
  heroElement.addEventListener(openingEvents.lanesReady, revealLanes, { once: true });
  const completeIntro = () => {
    introComplete = true;
    revealLanes();
    if (lanesComplete) startReading();
  };
  heroElement.addEventListener(openingEvents.introComplete, completeIntro, { once: true });
  const startIdentity = () => {
    if (identityStarted || timeline.finished || !page.isConnected) return;
    identityStarted = true;
    if (reading) pageWatch.stop();
    hero.start();
    timeline.start('identity');
    timeline.later(hero.startBio, time.formStart);
    hero.scheduleCues();
  };
  heroElement.addEventListener(openingEvents.greetingComplete, () => safely(startIdentity), {
    once: true,
  });
  const startOpening = () => {
    if (timeline.finished || !page.isConnected) return;
    if (!openingPending()) return skipOpening();
    hero.startTyping();
    // Returns and phones go straight to the portrait; only a fresh desktop visit leads with typing.
    if (returning || isPhone() || heroElement.hasAttribute('data-greeting-complete'))
      startIdentity();
    // A restored scroll position can complete the text before this script attaches its listeners.
    if (introComplete) completeIntro();
    // The visitor may already have scrolled while resources were loading.
    onScroll();
    liftOpeningGate();
  };
  const skipOpening = () => {
    timeline.finish();
    window.clearTimeout(readyTimeout);
    pageWatch.stop();
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
    new Promise<void>((resolve) => {
      readyTimeout = window.setTimeout(resolve, time.readyTimeout);
    }),
  ]).then(() => {
    window.clearTimeout(readyTimeout);
    // Let the browser paint after preparation, then let the greeting lead the opening.
    requestAnimationFrame(() => requestAnimationFrame(() => safely(startOpening)));
  });
}

enhance('[data-opening-content]', (page) => {
  void waitForPageReady().then(() => setupHomeOpening(page));
});
