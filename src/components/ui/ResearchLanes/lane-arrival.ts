import { laneAnimations, laneTiming } from './lane-opening';

/** Bake row offsets into one shared duration so the page queue can delay the whole entrance. */
export function prepareLaneArrival(root: HTMLElement, pace: number) {
  const rows = [...root.querySelectorAll<HTMLElement>('[data-lane-row]')];
  const duration = (laneTiming.light + Math.max(0, rows.length - 1) * laneTiming.stagger) * pace;
  const animations: Animation[] = [];
  rows.forEach((row, index) => {
    row.setAttribute('data-connecting', '');
    for (const { element, frames, timing } of laneAnimations(
      row,
      laneTiming.field * pace,
      laneTiming.light * pace,
      0,
    )) {
      if (!element) continue;
      const start = index * laneTiming.stagger * pace;
      const keys = frames.map((key, i) => ({
        ...key,
        offset:
          (start + Number(key.offset ?? i / (frames.length - 1)) * timing.duration) / duration,
        easing: timing.easing,
      }));
      const animation = element.animate(
        [{ ...frames[0], offset: 0 }, ...keys, { ...frames.at(-1), offset: 1 }],
        { duration, easing: 'linear', fill: 'both' },
      );
      animations.push(animation);
    }
  });
  const release = () => rows.forEach((row) => row.removeAttribute('data-connecting'));
  void Promise.allSettled(animations.map((animation) => animation.finished)).then(release);
  return {
    animations,
    startDrift(delay: number) {
      rows.forEach((row, i) =>
        window.setTimeout(
          () => row.removeAttribute('data-connecting'),
          delay + (i * laneTiming.stagger + laneTiming.drift) * pace,
        ),
      );
    },
  };
}
