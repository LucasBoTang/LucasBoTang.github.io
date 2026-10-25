import { canPresentFigure, hasFigureDrawn } from '../../../lib/figure-ready.ts';

/** Keep the first-frame poster on failure; only a fully drawn, fitted document may replace it. */
export function presentFigureWhenDrawn(host: HTMLElement, frame: HTMLIFrameElement) {
  let observer: MutationObserver | undefined;
  let paint = 0;
  const stop = () => {
    observer?.disconnect();
    observer = undefined;
    cancelAnimationFrame(paint);
  };
  const loaded = async () => {
    stop();
    host.removeAttribute('data-figure-live');
    const inner = frame.contentDocument;
    if (!inner || inner.URL === 'about:blank') return;
    await Promise.allSettled([
      inner.fonts.ready,
      ...[...inner.images].map((image) => image.decode()),
    ]);
    if (frame.contentDocument !== inner) return;
    const check = () => {
      if (hasFigureDrawn(inner)) {
        stop();
        // Match the existing fitting/paint boundary before handing the same box to live rendering.
        paint = requestAnimationFrame(() => {
          paint = requestAnimationFrame(() => {
            if (frame.contentDocument === inner) host.setAttribute('data-figure-live', '');
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
  frame.addEventListener('error', stop);
  if (frame.contentDocument?.readyState === 'complete') void loaded();
}
