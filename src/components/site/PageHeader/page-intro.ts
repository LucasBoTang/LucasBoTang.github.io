import { arrival, arrivalFrames } from '../../../lib/arrival';
import { phonePace } from '../../../lib/breakpoints';
import { enhance } from '../../../lib/lifecycle';
import { onKeyboardFocus, reducedMotionQuery, watchActivity } from '../../../lib/motion';
import { createTyping, type TypingRhythm } from '../../ui/TypedText/typed-text';

/** The introduction types alongside the title; body readiness never holds it back. */
function setupPageIntro(intro: HTMLElement) {
  const host = intro.querySelector<HTMLElement>('[data-typed-text]');
  if (!host || reducedMotionQuery().matches || !Element.prototype.animate) return;
  const rhythm: TypingRhythm = JSON.parse(intro.dataset.typingRhythm ?? '{}');
  let stopKeyboardWatch = () => {};
  const typing = createTyping(host, {
    ...rhythm,
    duringOpening: true,
    onComplete: () => stopKeyboardWatch(),
  });
  const entrance = intro.animate(arrivalFrames(intro), {
    duration: arrival.duration * phonePace(),
    easing: arrival.easing,
    fill: 'both',
  });
  entrance.onfinish = () => entrance.cancel();
  intro.dataset.introStarted = String(performance.now());
  const finish = () => {
    entrance.cancel();
    typing.finish();
  };
  stopKeyboardWatch = onKeyboardFocus(finish);
  watchActivity(intro, (activity) => {
    if (activity.reduced) finish();
    typing.setRunning(!activity.hidden && activity.inView.has(intro));
  });
}

enhance('[data-page-intro]', setupPageIntro);
