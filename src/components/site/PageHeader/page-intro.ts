import { arrival, arrivalFrames } from '../../../lib/arrival';
import { phonePace } from '../../../lib/breakpoints';
import { enhance } from '../../../lib/lifecycle';
import { onKeyboardFocus, reducedMotionQuery, watchActivity } from '../../../lib/motion';
import { openingHeld } from '../../../lib/opening-gate';
import { createTyping, type TypingRhythm } from '../../ui/TypedText/typed-text';

/** The introduction types alongside the title; body readiness never holds it back. Work that
 * holds the opening back (opening-gate.ts `holdOpening`) keeps its first key waiting behind the
 * caret, but never interrupts typing once it has begun. */
function setupPageIntro(intro: HTMLElement) {
  const host = intro.querySelector<HTMLElement>('[data-typed-text]');
  if (!host || reducedMotionQuery().matches || !Element.prototype.animate) return;
  const rhythm: TypingRhythm = JSON.parse(intro.dataset.typingRhythm ?? '{}');
  let stopKeyboardWatch = () => {};
  const typing = createTyping(host, {
    ...rhythm,
    duringOpening: true,
    held: () => !host.hasAttribute('data-typing-started') && openingHeld(),
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
