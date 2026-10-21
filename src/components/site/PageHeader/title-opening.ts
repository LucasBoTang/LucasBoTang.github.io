import { arrival } from '../../../lib/arrival';
import { phonePace } from '../../../lib/breakpoints';
import { enhance } from '../../../lib/lifecycle';
import { onKeyboardFocus, reducedMotionQuery } from '../../../lib/motion';
import { decodeTitle } from './title-decode';

const TITLE_DURATION = 1000;
const TITLE_WIPE: Keyframe[] = [
  { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
  { opacity: 1, clipPath: 'inset(0 0 0% 0)' },
];

/** Starts beside the introduction: wipe on a direct visit, decode on an internal navigation. */
function setupTitleOpening(title: HTMLElement) {
  if (title.hasAttribute('data-title-from')) return decodeTitle(title);
  const reducedMotion = reducedMotionQuery();
  if (reducedMotion.matches || !Element.prototype.animate) return;
  const entrance = title.animate(TITLE_WIPE, {
    duration: TITLE_DURATION * phonePace(),
    easing: arrival.easing,
    fill: 'both',
  });
  const finish = () => {
    entrance.cancel();
    stopKeyboardWatch();
    reducedMotion.removeEventListener('change', finish);
  };
  const stopKeyboardWatch = onKeyboardFocus(finish);
  entrance.onfinish = finish;
  reducedMotion.addEventListener('change', finish);
}

enhance('[data-reveal="title"]', setupTitleOpening);
