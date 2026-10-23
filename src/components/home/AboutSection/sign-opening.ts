import { ARRIVAL_EVENT } from '../../../lib/arrival';
import { openingPending, waitForOpeningVisible } from '../../../lib/opening-gate';

/** Track the section's actual fade, including delayed setup and skipped openings. */
export function whenSignVisible(section: HTMLElement | null, show: () => void) {
  let shown = false;
  let frame = 0;
  const finish = () => {
    if (shown) return;
    shown = true;
    cancelAnimationFrame(frame);
    section?.removeEventListener(ARRIVAL_EVENT, inspect);
    show();
  };
  const inspect = () => {
    if (shown || openingPending()) return;
    const animation = section
      ?.getAnimations()
      .find((animation) =>
        (animation.effect as KeyframeEffect)
          ?.getKeyframes()
          .some((key) => key.opacity !== undefined),
      );
    if (!animation) return finish();
    cancelAnimationFrame(frame);
    // Animation timing already includes easing; no style or geometry read is needed.
    const visible = () => {
      if (shown) return;
      if (
        animation.playState === 'idle' ||
        Number(animation.effect?.getComputedTiming().progress ?? 0) >= 0.05
      )
        finish();
      else if (animation.playState !== 'paused') frame = requestAnimationFrame(visible);
    };
    void animation.finished.then(finish, finish);
    visible();
  };
  section?.addEventListener(ARRIVAL_EVENT, inspect);
  void waitForOpeningVisible().then(inspect);
}
