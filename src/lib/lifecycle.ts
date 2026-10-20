// Pages load in full; the site has no client-side router. Module scripts run once, after the
// document is parsed, and never tear down: leaving discards the page, and the back-forward cache
// freezes timers, frames and observers, then resumes them as they were.

/** Calls `setup` once for each element matching `selector`. */
export function enhance<T extends Element = HTMLElement>(
  selector: string,
  setup: (element: T) => void,
): void {
  document.querySelectorAll<T>(selector).forEach(setup);
}

/**
 * Calls `setup` for each element matching `selector` once it first comes within a screen's height
 * of the viewport, above or below, so the work for what lies far down the page waits until the
 * reader nears it instead of crowding the page's first moments.
 */
export function enhanceNear<T extends Element = HTMLElement>(
  selector: string,
  setup: (element: T) => void,
): void {
  const elements = [...document.querySelectorAll<T>(selector)];
  if (!('IntersectionObserver' in window)) {
    elements.forEach(setup);
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        setup(entry.target as T);
      }
    },
    { rootMargin: '100% 0px' },
  );
  elements.forEach((element) => observer.observe(element));
}

/** Runs `work` once the browser is idle, or after `timeout` milliseconds at the latest. */
export function whenIdle(work: () => void, timeout = 400): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => work(), { timeout });
  else window.setTimeout(work, 1);
}

/**
 * Calls `update` at most once a frame while the page scrolls or the window resizes. Returns the
 * function that asks for an update, for other events that should prompt one.
 */
export function onScrollFrame(update: () => void): () => void {
  let frame = 0;
  const request = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request);
  return request;
}
