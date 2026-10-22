export type PlaybackBrowser = Pick<
  Window & typeof globalThis,
  | 'document'
  | 'matchMedia'
  | 'IntersectionObserver'
  | 'requestAnimationFrame'
  | 'cancelAnimationFrame'
>;

interface PlaybackOptions {
  /** Draw the first frame immediately, but defer its clock until the host is ready. */
  startWhen?: (start: () => void) => void;
  rate?: number;
  maxFrameDelta?: number;
  threshold?: number;
  /** Set the clock on reduced motion; omitted means retain its position. */
  reducedTime?: number;
}

/**
 * Own one animation clock in milliseconds. Visibility changes reset the frame
 * timestamp, so time spent offscreen or in a hidden tab never advances it.
 * Drawing remains the caller's responsibility, including its static view.
 */
export function createPlayback(
  target: Element,
  browser: PlaybackBrowser,
  draw: (elapsed: number, reducedMotion: boolean) => void,
  {
    rate = 1,
    maxFrameDelta = Infinity,
    threshold = 0,
    reducedTime,
    startWhen,
  }: PlaybackOptions = {},
) {
  const motion = browser.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let ready = !startWhen;
  let elapsed = 0;
  let previousTime: number | null = null;
  let frameId: number | null = null;
  let disposed = false;

  function redraw() {
    if (!disposed) {
      draw(elapsed, motion.matches);
    }
  }

  function frame(timestamp: number) {
    frameId = null;
    if (previousTime !== null) {
      elapsed += Math.min(maxFrameDelta, timestamp - previousTime) * rate;
    }
    previousTime = timestamp;
    redraw();
    if (!disposed) {
      frameId = browser.requestAnimationFrame(frame);
    }
  }

  function synchronize() {
    if (disposed) {
      return;
    }
    if (frameId !== null) {
      browser.cancelAnimationFrame(frameId);
    }
    frameId = null;
    previousTime = null;
    if (motion.matches && reducedTime !== undefined) {
      elapsed = reducedTime;
    }
    redraw();
    if (!disposed && ready && visible && !browser.document.hidden && !motion.matches) {
      frameId = browser.requestAnimationFrame(frame);
    }
  }

  const observer = new browser.IntersectionObserver(
    (entries) => {
      // One target can cross multiple boundaries before delivery.
      visible = entries[entries.length - 1].isIntersecting;
      synchronize();
    },
    { threshold },
  );
  observer.observe(target);
  motion.addEventListener('change', synchronize);
  browser.document.addEventListener('visibilitychange', synchronize);
  synchronize();
  startWhen?.(() => {
    ready = true;
    synchronize();
  });

  return {
    redraw,
    dispose() {
      disposed = true;
      if (frameId !== null) {
        browser.cancelAnimationFrame(frameId);
      }
      frameId = null;
      observer.disconnect();
      motion.removeEventListener('change', synchronize);
      browser.document.removeEventListener('visibilitychange', synchronize);
    },
  };
}
