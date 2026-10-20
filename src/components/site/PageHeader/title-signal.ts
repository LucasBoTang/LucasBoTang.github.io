import { enhance } from '../../../lib/lifecycle';
import { reducedMotionQuery, watchActivity } from '../../../lib/motion';
import { slipDuration, titleInterval } from '../../../lib/signal';

// Page titles keep the home name's signal: its slice glitch comes a moment after the title first
// comes into view, as if the signal settled on it, then on its own every seven to twelve seconds,
// at uneven moments, so the title is never quite still yet never busy. A title rewritten on arrival
// from another page has slipped as it was rewritten (title-decode.ts), so its next glitch waits a
// full pause. Off screen, in a background tab, or with reduced motion, the title keeps still.
const FIRST_DELAY = 1000;

function setupTitleSignal(title: HTMLElement) {
  const reducedMotion = reducedMotionQuery();
  let timer = 0;
  let glitched = !!title.closest('[data-title-from]');
  let active = false;

  const glitch = () => {
    if (title.hasAttribute('data-slip')) return;
    glitched = true;
    title.setAttribute('data-slip', '');
    window.setTimeout(() => title.removeAttribute('data-slip'), slipDuration());
  };
  /** Waits the delay that is due, glitches, and waits again, while the title can be seen. */
  const schedule = () => {
    window.clearTimeout(timer);
    if (!active) return;
    timer = window.setTimeout(
      () => {
        glitch();
        schedule();
      },
      glitched ? titleInterval() : FIRST_DELAY,
    );
  };

  watchActivity(title, (activity) => {
    active = !activity.hidden && !activity.reduced && activity.inView.size > 0;
    schedule();
  });
  reducedMotion.addEventListener('change', () => title.removeAttribute('data-slip'));
}

enhance('.title-signal', setupTitleSignal);
