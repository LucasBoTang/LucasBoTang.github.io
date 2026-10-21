import { phonePace } from '../../../lib/breakpoints';
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
export function addLaneOpening(
  timeline: Timeline<HomeOpeningGroup>,
  navigator: HTMLElement,
  returning: boolean,
) {
  const pace = phonePace();
  let started = false;
  const rows = Array.from(navigator.querySelectorAll<HTMLElement>('.research-topic'));
  rows.forEach((row, i) => {
    row.setAttribute('data-connecting', '');
    const group = `lane-${i}` as const;
    timeline.animate(
      row,
      [{ opacity: 0 }, { opacity: 1, offset: LANE_FADE_IN }, { opacity: 1 }],
      { duration: time.laneField * pace, easing: 'linear' },
      group,
    );
    timeline.animate(
      row.querySelector('.lane-field'),
      [{ '--lane-open': '0' }, { '--lane-open': '1' }],
      { duration: time.laneField * pace, easing: OPEN_EASING },
      group,
    );
    timeline.animate(
      row.querySelector('.lane-ghosts'),
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: time.laneField * pace, easing: OPEN_EASING },
      group,
    );
    timeline.animate(
      row.querySelector('.lane-light-window'),
      [
        { '--lane-open': '0', opacity: 0 },
        { '--lane-open': '1', opacity: 1 },
      ],
      { duration: time.laneLight * pace, delay: time.laneLightDelay * pace, easing: OPEN_EASING },
      group,
    );
  });

  return {
    /** Staggers when visible. Fresh actions join the last lane's tail; returns keep first light. */
    start(action: () => void, opened: () => void) {
      if (started || timeline.finished) return;
      started = true;
      if (!rows.length) {
        action();
        opened();
        return;
      }
      timeline.whenVisible(navigator, () => {
        rows.forEach((row, i) =>
          timeline.later(
            () => {
              timeline.start(`lane-${i}`);
              timeline.later(() => row.removeAttribute('data-connecting'), time.laneDrift * pace);
              if (returning && i === 0) timeline.later(action, time.laneLightDelay * pace);
              if (i === rows.length - 1) {
                const settled =
                  Math.max(time.laneField, time.laneLightDelay + time.laneLight) * pace;
                const actionAt = Math.max(0, settled - time.actionLead * pace);
                if (!returning) timeline.later(action, actionAt);
                timeline.later(
                  opened,
                  returning ? settled : Math.max(time.laneField * pace, actionAt + time.actionFade),
                );
              }
            },
            (time.laneOffsets[i] ?? 0) * pace,
          ),
        );
      });
    },
    skip() {
      rows.forEach((row) => row.removeAttribute('data-connecting'));
    },
  };
}
