import { canPresentFigure, hasFigureDrawn } from '../../../lib/figure-ready.ts';
import { reducedMotionQuery } from '../../../lib/motion.ts';

/** Keep the first-frame poster on failure; only a fully drawn, fitted document may replace it. */
export function presentFigureWhenDrawn(host: HTMLElement, frame: HTMLIFrameElement) {
  let generation = 0;
  let observer: MutationObserver | undefined;
  let paint = 0;
  let handover: Animation | undefined;
  const stop = () => {
    observer?.disconnect();
    observer = undefined;
    cancelAnimationFrame(paint);
    handover?.cancel();
    handover = undefined;
  };
  const loaded = async () => {
    const current = ++generation;
    stop();
    host.removeAttribute('data-figure-live');
    host.setAttribute('data-figure-poster-pending', '');
    const inner = frame.contentDocument;
    if (!inner || inner.URL === 'about:blank') return;
    await Promise.allSettled([
      inner.fonts.ready,
      ...[...inner.images].map((image) => image.decode()),
    ]);
    if (current !== generation || frame.contentDocument !== inner) return;
    const check = () => {
      if (current !== generation || frame.contentDocument !== inner) return;
      if (hasFigureDrawn(inner)) {
        stop();
        // Match the existing fitting/paint boundary before handing the same box to live rendering.
        paint = requestAnimationFrame(() => {
          paint = requestAnimationFrame(() => {
            if (current !== generation || frame.contentDocument !== inner) return;
            const finish = () => {
              if (current !== generation || frame.contentDocument !== inner) return;
              host.setAttribute('data-figure-live', '');
              host.removeAttribute('data-figure-poster-pending');
            };
            const poster = host.querySelector<HTMLElement>('[data-figure-poster]');
            const image = poster?.querySelector('img');
            // The live clock stays at t=0 while the matching image gives way.
            if (
              poster &&
              image?.complete &&
              image.naturalWidth > 0 &&
              !reducedMotionQuery().matches
            ) {
              handover = poster.animate({ opacity: [1, 0] }, { duration: 120, easing: 'linear' });
              void handover.finished.then(finish, () => {});
            } else finish();
          });
        });
      } else if (canPresentFigure(inner)) stop();
    };
    observer = new MutationObserver(check);
    for (const renderer of inner.querySelectorAll('[data-figure-drawn]'))
      observer.observe(renderer, { attributes: true, attributeFilter: ['data-figure-drawn'] });
    check();
  };
  frame.addEventListener('load', () => {
    void loaded();
  });
  frame.addEventListener('error', () => {
    generation++;
    stop();
  });
  if (frame.contentDocument?.readyState === 'complete') void loaded();
}
