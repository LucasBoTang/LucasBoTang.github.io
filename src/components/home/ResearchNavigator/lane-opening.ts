import type { Timeline } from '../../../lib/timeline';
import { openingTiming as time, type HomeOpeningGroup } from '../opening/opening';

/** The lanes open quick to leave and slow to settle. */
const OPEN_EASING = 'cubic-bezier(.3,0,.2,1)';
/** How far through its opening a lane reaches full opacity. */
const LANE_FADE_IN = 0.22;

/**
 * The research lanes' part of the home opening: one slow swell, each lane on its own clock
 * (`lane-0`, `lane-1`, ...), slightly after the one above. A lane's dim field opens from its
 * centre, its words starting to drift almost at once, and its light swells in behind it.
 */
export function addLaneOpening(timeline: Timeline<HomeOpeningGroup>, navigator: HTMLElement) {
  const rows = Array.from(navigator.querySelectorAll<HTMLElement>('.research-topic'));
  rows.forEach((row, i) => {
    row.setAttribute('data-connecting', '');
    const group = `lane-${i}` as const;
    timeline.animate(
      row,
      [{ opacity: 0 }, { opacity: 1, offset: LANE_FADE_IN }, { opacity: 1 }],
      { duration: time.laneField, easing: 'linear' },
      group,
    );
    timeline.animate(
      row.querySelector('.lane-field'),
      [{ '--lane-open': '0' }, { '--lane-open': '1' }],
      { duration: time.laneField, easing: OPEN_EASING },
      group,
    );
    timeline.animate(
      row.querySelector('.lane-ghosts'),
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: time.laneField, easing: OPEN_EASING },
      group,
    );
    timeline.animate(
      row.querySelector('.lane-light-window'),
      [
        { '--lane-open': '0', opacity: 0 },
        { '--lane-open': '1', opacity: 1 },
      ],
      { duration: time.laneLight, delay: time.laneLightDelay, easing: OPEN_EASING },
      group,
    );
  });

  return {
    /** Opens each lane in turn, once it is on screen; calls `begun` as the first one opens and
     * `opened` once every field is open. */
    start(begun: () => void, opened: () => void) {
      let pending = rows.length;
      if (!pending) {
        begun();
        opened();
      }
      rows.forEach((row, i) =>
        timeline.later(
          () =>
            timeline.whenVisible(row, () => {
              timeline.start(`lane-${i}`);
              timeline.later(() => row.removeAttribute('data-connecting'), time.laneDrift);
              if (i === 0) begun();
              timeline.later(() => {
                pending -= 1;
                if (!pending) opened();
              }, time.laneField);
            }),
          time.laneDelay + (time.laneOffsets[i] ?? 0),
        ),
      );
    },
    skip() {
      rows.forEach((row) => row.removeAttribute('data-connecting'));
    },
  };
}
