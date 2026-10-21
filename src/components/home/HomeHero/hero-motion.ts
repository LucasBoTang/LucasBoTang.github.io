import { enhance, onScrollFrame } from '../../../lib/lifecycle';
import { reducedMotionQuery, watchActivity } from '../../../lib/motion';
import { openingEvents } from '../opening/opening';
import { createIntroTyping } from './intro-typing';
import { createPortraitSignal } from './portrait-signal';

function setupHero(hero: HTMLElement) {
  const reducedMotion = reducedMotionQuery();
  let inView = true;
  const portraitSignal = createPortraitSignal(hero);
  const typing = createIntroTyping(hero);
  function updateMotion() {
    hero.toggleAttribute('data-motion-ready', !reducedMotion.matches);
    hero.toggleAttribute('data-motion-suspended', !inView || document.hidden);
    portraitSignal.setRunning(!reducedMotion.matches && inView && !document.hidden);
    if (
      reducedMotion.matches ||
      !Element.prototype.animate ||
      hero.hasAttribute('data-intro-skipped')
    ) {
      scrollWatch.stop();
      typing.finish();
    }
    // Finished passages still need viewport and tab activity updates for their blinking caret.
    typing.setRunning(!document.hidden);
  }
  // Text follows each paragraph's viewport, including fast jumps past the entire passage.
  const scrollWatch = onScrollFrame(updateMotion);
  hero.addEventListener(openingEvents.introComplete, scrollWatch.stop, { once: true });
  hero.addEventListener(
    openingEvents.skip,
    () => {
      scrollWatch.stop();
      typing.finish();
    },
    { once: true },
  );
  watchActivity([hero, ...hero.querySelectorAll<HTMLElement>('[data-typed-text]')], (activity) => {
    if (activity.reason === 'viewport') {
      inView = activity.inView.has(hero);
    }
    updateMotion();
  });
  updateMotion();
}

enhance('[data-home-motion]', setupHero);
