import { ARRIVAL_EVENT } from '../../../lib/arrival';
import { preparePicture, preparePoster } from './picture-ready';

// Research figures establish a steady picture, then join their own motion during the fade.
// These timings belong to the reading page; home previews retain their separate handover.
const DURATION = 450;
const PLAYBACK_AT = 200;
const CAPTION_AT = 160;
const EASING = 'cubic-bezier(.33,0,.2,1)';
/** A failed or stalled document must not hold the figure and its caption indefinitely. */
const PICTURE_TIMEOUT_MS = 5000;

export function screenArrival(screen: Element, trigger: Element): Animation[] | null {
  const picture = screen.querySelector('.screen-picture');
  const frame = picture?.querySelector('iframe');
  if (!picture || !frame) return null;
  const timing: KeyframeAnimationOptions = { duration: DURATION, easing: EASING, fill: 'both' };
  const opening = picture.animate({ opacity: [0, 1] }, timing);
  screen.setAttribute('data-screen-pending', '');
  // An empty effect shares the queue's delay, pause and cancellation without another timer.
  const playback = screen.animate([], PLAYBACK_AT);
  const poster = screen.querySelector<HTMLImageElement>('[data-figure-poster] img');
  // A static first frame lets content arrive without waiting for compilation or an iframe load.
  const preparation = poster
    ? preparePoster(poster, screen.querySelector('[data-scalable-figure]'))
    : preparePicture(frame);
  let deadline = 0;
  const releasePlayback = () => {
    clearTimeout(deadline);
    preparation.cancel();
    screen.removeAttribute('data-screen-pending');
  };
  playback.onfinish = opening.oncancel = releasePlayback;
  const group = [
    opening,
    playback,
    ...Array.from(screen.closest('figure')!.querySelectorAll('figcaption, details'), (copy) =>
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
  trigger.addEventListener(
    ARRIVAL_EVENT,
    (event) => {
      const at = performance.now() + (event as CustomEvent<{ delay: number }>).detail.delay;
      // The queue has just played the group. Hold its first frame until the picture exists,
      // retaining any reading delay that remains rather than adding that delay a second time.
      group.forEach((animation) => animation.pause());
      // Start the bound on arrival, not while an offscreen figure is still lazily unloaded.
      deadline = window.setTimeout(
        () => preparation.cancel(),
        Math.max(0, at - performance.now()) + PICTURE_TIMEOUT_MS,
      );
      void preparation.ready.then(() => {
        clearTimeout(deadline);
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
