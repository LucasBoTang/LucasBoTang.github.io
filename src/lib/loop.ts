// A frame loop for animations that pause and resume. Its clock counts only the time the loop runs
// and is not held, so an animation picks up where it stopped, and a stalled frame advances it by
// no more than `MAX_STEP`.

const MAX_STEP = 80;

interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
  /** Milliseconds counted so far. */
  readonly elapsed: number;
}

/**
 * Calls `onFrame` with the clock on every frame while running. While `held` returns true, the
 * clock stands still and `onFrame` is not called.
 */
export function createLoop(
  onFrame: (elapsed: number) => void,
  held?: () => boolean,
  maxStep = MAX_STEP,
): Loop {
  let elapsed = 0;
  let previous = 0;
  let request = 0;
  let running = false;

  const step = (now: number) => {
    // Ask for the next frame first, so `onFrame` can stop the loop.
    request = requestAnimationFrame(step);
    if (held?.()) {
      previous = 0;
      return;
    }
    elapsed += previous ? Math.min(now - previous, maxStep) : 0;
    previous = now;
    onFrame(elapsed);
  };

  return {
    start() {
      if (running) return;
      running = true;
      previous = 0;
      request = requestAnimationFrame(step);
    },
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(request);
    },
    get running() {
      return running;
    },
    get elapsed() {
      return elapsed;
    },
  };
}
