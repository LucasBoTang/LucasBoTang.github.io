/** Start an embedded figure at its first frame after the host's entrance has settled.
 * Standalone figures and hosts without an entrance start immediately. The host's opening
 * fallback and keyboard/reduced-motion skip both release the same gate. */
export function whenFigureReady(start: () => void): void {
  // A figure drawn ahead in a warm-up slot (FigureWarmup) is there only to be drawn.
  if (window.frameElement?.closest('[data-figure-warmup]')) {
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
