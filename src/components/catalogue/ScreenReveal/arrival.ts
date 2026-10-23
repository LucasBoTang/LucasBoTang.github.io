import { ARRIVAL_EVENT } from '../../../lib/arrival';
import { waitForPicture } from './picture-ready';

// Research figures establish a steady picture, then join their own motion during the fade.
// These timings belong to the reading page; home previews retain their separate handover.
const DURATION = 450;
const PLAYBACK_AT = 200;
const CAPTION_AT = 160;
const EASING = 'cubic-bezier(.33,0,.2,1)';

export function screenArrival(element: Element): Animation[] | null {
  const screen = element.querySelector('.screen-reveal');
  const picture = screen?.querySelector('.screen-picture');
  const trigger = screen?.querySelector('[data-reveal="unit"]');
  const frame = picture?.querySelector('iframe');
  if (!screen || !picture || !trigger || !frame) return null;
  const timing: KeyframeAnimationOptions = { duration: DURATION, easing: EASING, fill: 'both' };
  const opening = picture.animate([{ opacity: 0 }, { opacity: 1 }], timing);
  screen.setAttribute('data-screen-pending', '');
  const releasePlayback = () => screen.removeAttribute('data-screen-pending');
  // An empty effect shares the queue's delay, pause and cancellation without another timer.
  const playback = screen.animate([], PLAYBACK_AT);
  playback.onfinish = releasePlayback;
  opening.oncancel = releasePlayback;
  const group = [
    opening,
    playback,
    ...Array.from(element.querySelectorAll('figcaption, details'), (copy) =>
      copy.animate(
        [
          { offset: 0, opacity: 0 },
          { offset: CAPTION_AT / DURATION, opacity: 0, easing: EASING },
          { offset: 1, opacity: 1 },
        ],
        { ...timing, easing: 'linear' },
      ),
    ),
  ];
  const prepared = waitForPicture(frame);
  trigger.addEventListener(
    ARRIVAL_EVENT,
    (event) => {
      const at = performance.now() + (event as CustomEvent<{ delay: number }>).detail.delay;
      // The queue has just played the group. Hold its first frame until the picture exists,
      // retaining any reading delay that remains rather than adding that delay a second time.
      group.forEach((animation) => animation.pause());
      void prepared.then(() => {
        // Keyboard focus, reduced motion and the page fallback may already have shown everything.
        if (opening.playState === 'idle') return;
        const delay = Math.max(0, at - performance.now());
        group.forEach((animation) => {
          animation.effect?.updateTiming({ delay });
          animation.play();
        });
      });
    },
    { once: true },
  );
  return group;
}
