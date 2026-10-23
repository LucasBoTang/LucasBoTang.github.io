// A resumable active-time clock. Held frames and pauses do not advance elapsed time.

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
  let previousTime = 0;
  let frameId = 0;
  let running = false;

  const step = (now: number) => {
    // Ask for the next frame first, so `onFrame` can stop the loop.
    frameId = requestAnimationFrame(step);
    if (held?.()) {
      previousTime = 0;
      return;
    }
    elapsed += previousTime ? Math.min(now - previousTime, maxStep) : 0;
    previousTime = now;
    onFrame(elapsed);
  };

  return {
    start() {
      if (running) return;
      running = true;
      previousTime = 0;
      frameId = requestAnimationFrame(step);
    },
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frameId);
    },
    get running() {
      return running;
    },
    get elapsed() {
      return elapsed;
    },
  };
}
