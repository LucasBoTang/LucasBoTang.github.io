import { enhance } from '../../../lib/lifecycle';
import { onKeyboardFocus, reducedMotionQuery, watchActivity } from '../../../lib/motion';
import { openingPending } from '../../../lib/opening-gate';
import { waitForPageReady } from '../../../lib/page-ready';
import { createTyping, type TypingRhythm } from '../../ui/TypedText/typed-text';

/** The lead keeps its entrance, then types once it has settled into readable text. */
function setupPageIntro(intro: HTMLElement) {
  const host = intro.querySelector<HTMLElement>('[data-typed-text]');
  if (!host || reducedMotionQuery().matches) return;
  const rhythm: TypingRhythm = JSON.parse(intro.dataset.typingRhythm ?? '{}');
  let ready = false;
  let active = false;
  let stopKeyboardWatch = () => {};
  const typing = createTyping(host, {
    ...rhythm,
    held: () => !ready,
    onComplete: () => stopKeyboardWatch(),
  });
  stopKeyboardWatch = onKeyboardFocus(typing.finish);
  watchActivity(intro, (activity) => {
    active = !activity.hidden && activity.inView.has(intro);
    if (activity.reduced) typing.finish();
    typing.setRunning(ready && active);
  });

  void waitForPageReady().then(async () => {
    // A slow script can prepare Reveal later than this module. The gate opens only after those
    // entrances are prepared, or when skipped, so collect them after it has lifted.
    if (openingPending()) {
      await new Promise<void>((resolve) => {
        const observer = new MutationObserver(() => {
          if (openingPending()) return;
          observer.disconnect();
          resolve();
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-opening-pending'],
        });
      });
    }
    await Promise.allSettled(intro.getAnimations().map((animation) => animation.finished));
    ready = true;
    typing.setRunning(active);
  });
}

enhance('[data-page-intro]', setupPageIntro);
