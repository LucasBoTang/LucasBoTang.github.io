import { phonePace } from '../../../lib/breakpoints';
import type { Timeline } from '../../../lib/timeline';
import { laneAnimations } from '../../ui/ResearchLanes/lane-opening';
import { openingTiming as time, type HomeOpeningGroup } from './opening';

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
  // A fresh opening lights as soon as the field starts, so it is visible at the bio's last word.
  // Site returns keep their original first-light cue.
  const lightDelay = returning ? time.laneLightDelay : 0;
  let started = false;
  const rows = Array.from(navigator.querySelectorAll<HTMLElement>('[data-lane-row]'));
  rows.forEach((row, i) => {
    row.setAttribute('data-connecting', '');
    const group = `lane-${i}` as const;
    for (const animation of laneAnimations(
      row,
      time.laneField * pace,
      time.laneLight * pace,
      lightDelay * pace,
    ))
      timeline.animate(animation.element, animation.frames, animation.timing, group);
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
                const settled = Math.max(time.laneField, lightDelay + time.laneLight) * pace;
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
