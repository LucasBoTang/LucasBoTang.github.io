import { createLoop } from './loop.ts';
import { reducedMotionQuery, watchActivity } from './motion.ts';

interface FigureClockOptions {
  startWhen?: (start: () => void) => void;
  duration?: number;
  rate?: number;
  maxFrameDelta?: number;
  threshold?: number;
  reducedTime?: number;
}

/** One resumable clock for an illustration and all of its readouts. */
export function createFigureClock(
  target: Element,
  draw: (elapsed: number, reduced: boolean) => void,
  {
    startWhen,
    duration = Infinity,
    rate = 1,
    maxFrameDelta = 80,
    threshold = 0,
    reducedTime,
  }: FigureClockOptions = {},
) {
  let ready = !startWhen;
  let disposed = false;
  let reduced = reducedMotionQuery().matches;
  let active = false;
  let elapsed = 0;
  let previous = 0;
  const redraw = () => {
    if (!disposed) draw(elapsed, reduced);
  };
  const loop = createLoop(
    (time) => {
      elapsed = Math.min(duration, elapsed + (time - previous) * rate);
      previous = time;
      redraw();
      if (elapsed >= duration) loop.stop();
    },
    undefined,
    maxFrameDelta,
  );
  const synchronize = () => {
    if (disposed) return;
    if (reduced && reducedTime !== undefined) elapsed = reducedTime;
    if (ready && active && !reduced && elapsed < duration) loop.start();
    else loop.stop();
    redraw();
  };
  const unwatch = watchActivity(
    target,
    ({ inView, hidden, reduced: preference }) => {
      reduced = preference;
      active = inView.has(target) && !hidden;
      synchronize();
    },
    { threshold },
  );
  synchronize();
  startWhen?.(() => {
    ready = true;
    synchronize();
  });
  return {
    redraw,
    dispose() {
      disposed = true;
      loop.stop();
      unwatch();
    },
  };
}
