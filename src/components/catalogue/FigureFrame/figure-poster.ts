import { hasFigureDrawn } from '../../../lib/figure-ready.ts';
import { reducedMotionQuery } from '../../../lib/motion.ts';

/** Keep a complete first frame available before handover and after renderer failure. */
export function presentFigureWhenDrawn(host: HTMLElement, frame: HTMLIFrameElement) {
  const poster = host.querySelector<HTMLElement>('[data-figure-poster]');
  const image = poster?.querySelector('img');
  const sources = [...(poster?.querySelectorAll('source') ?? [])];
  const originalSource = image?.getAttribute('src') ?? '';
  let frozen = false;
  let generation = 0;
  let observer: MutationObserver | undefined;
  let paint = 0;
  let handover: Animation | undefined;

  const cancelHandover = () => {
    cancelAnimationFrame(paint);
    paint = 0;
    handover?.cancel();
    handover = undefined;
  };
  const showPoster = () => {
    cancelHandover();
    if (frozen && poster && image) {
      poster.prepend(...sources);
      image.src = originalSource;
      frozen = false;
    }
    host.removeAttribute('data-figure-live');
    host.setAttribute('data-figure-poster-pending', '');
  };
  const freezePoster = () => {
    if (frozen || !image) return;
    // A hidden picture still fetches media-query changes. Pin its current image until needed.
    image.src = image.currentSrc || image.src;
    sources.forEach((source) => source.remove());
    frozen = true;
  };
  const loaded = async () => {
    const current = ++generation;
    observer?.disconnect();
    showPoster();
    const inner = frame.contentDocument;
    if (!inner || inner.URL === 'about:blank') return;
    const resources = await Promise.allSettled([
      inner.fonts.ready,
      ...[...inner.images].map((image) => image.decode()),
    ]);
    if (
      current !== generation ||
      frame.contentDocument !== inner ||
      resources.some((result) => result.status === 'rejected')
    )
      return;
    const check = () => {
      if (current !== generation || frame.contentDocument !== inner) return;
      if (!hasFigureDrawn(inner)) {
        showPoster();
        return;
      }
      if (host.hasAttribute('data-figure-live') || paint || handover) return;
      // Fit and commit the first frame before handing the same box to live rendering.
      paint = requestAnimationFrame(() => {
        paint = requestAnimationFrame(() => {
          paint = 0;
          if (current !== generation || frame.contentDocument !== inner || !hasFigureDrawn(inner))
            return;
          const finish = () => {
            if (current !== generation || frame.contentDocument !== inner || !hasFigureDrawn(inner))
              return;
            handover = undefined;
            freezePoster();
            host.setAttribute('data-figure-live', '');
            host.removeAttribute('data-figure-poster-pending');
          };
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
    observer?.disconnect();
    showPoster();
  });
  if (frame.contentDocument?.readyState === 'complete') void loaded();
}
