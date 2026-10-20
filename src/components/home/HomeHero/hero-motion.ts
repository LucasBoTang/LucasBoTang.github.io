import { enhance, onScrollFrame } from '../../../lib/lifecycle';
import { reducedMotionQuery, watchActivity } from '../../../lib/motion';
import { openingEvents } from '../opening/opening';
import { createIntroTyping } from './intro-typing';
import { createPortraitSignal } from './portrait-signal';

function setupHero(hero: HTMLElement) {
  const reducedMotion = reducedMotionQuery();
  let inView = true;
  const introText = hero.querySelector<HTMLElement>('.hero-intro');
  let introTextInView = !!introText && introText.getBoundingClientRect().top < window.innerHeight;
  const portraitSignal = createPortraitSignal(hero);
  const typing = createIntroTyping(hero);
  function updateMotion() {
    hero.toggleAttribute('data-motion-ready', !reducedMotion.matches);
    hero.toggleAttribute('data-motion-suspended', !inView || document.hidden);
    portraitSignal.setRunning(!reducedMotion.matches && inView && !document.hidden);
    if (reducedMotion.matches) typing.finish();
    else
      typing.setRunning(
        (introTextInView || (!!introText && introText.getBoundingClientRect().bottom < 0)) &&
          !document.hidden,
      );
  }
  // A fast scroll can jump over the introText without changing either observer's state.
  const scrollWatch = onScrollFrame(updateMotion);
  hero.addEventListener(openingEvents.introComplete, scrollWatch.stop, { once: true });
  hero.addEventListener(openingEvents.skip, () => typing.finish(), { once: true });
  watchActivity(introText ? [hero, introText] : [hero], (activity) => {
    if (activity.reason === 'viewport') {
      inView = activity.inView.has(hero);
      if (introText) introTextInView = activity.inView.has(introText);
    }
    updateMotion();
  });
  updateMotion();
}

enhance('[data-home-motion]', setupHero);
