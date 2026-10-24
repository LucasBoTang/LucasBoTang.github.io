/** Whether this figure is drawn ahead in a warm-up slot (FigureWarmup), only to be drawn. */
export const inWarmupSlot = () => Boolean(window.frameElement?.closest('[data-figure-warmup]'));

/** Start an embedded figure at its first frame after the host's entrance has settled.
 * Standalone figures and hosts without an entrance start immediately. The host's opening
 * fallback and keyboard/reduced-motion skip both release the same gate. */
export function whenFigureReady(start: () => void): void {
  if (inWarmupSlot()) {
    start();
    return;
  }
  const screen = window.frameElement?.closest('[data-screen-reveal], [data-figure-preview]');
  if (!screen) {
    start();
    return;
  }
  const page = screen.ownerDocument.documentElement;
  const waiting = () =>
    page.hasAttribute('data-opening-pending') ||
    screen.hasAttribute('data-screen-pending') ||
    screen.hasAttribute('data-preview-pending');
  if (!waiting()) {
    start();
    return;
  }
  const observer = new MutationObserver(() => {
    if (waiting()) return;
    observer.disconnect();
    start();
  });
  observer.observe(page, { attributes: true, attributeFilter: ['data-opening-pending'] });
  observer.observe(screen, {
    attributes: true,
    attributeFilter: ['data-screen-pending', 'data-preview-pending'],
  });
}

/** Report a renderer's first completed draw once, independently of its playback gate. */
export function createFigureDrawReporter(target: Element) {
  let reported = false;
  return () => {
    if (reported) return;
    reported = true;
    target.setAttribute('data-figure-drawn', '');
  };
}

/** All renderers declared by the document must finish a draw before it can be warmed. */
export function hasFigureDrawn(document: Document | null): boolean {
  const renderers = [...(document?.querySelectorAll('[data-figure-drawn]') ?? [])];
  return (
    renderers.length > 0 && renderers.every((node) => node.getAttribute('data-figure-drawn') === '')
  );
}
