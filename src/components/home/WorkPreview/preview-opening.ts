import { openingPending } from '../../../lib/opening-gate.ts';

/** The homepage has two gates: first visible frame, then the portrait's completed boot. */
export function createPreviewOpeningGate() {
  // The page gate lifts at the first visible frame, before the portrait's boot has finished.
  // Retain pointer/touch intent, but wait for both stages before loading any thumbnail.
  const hero = document.querySelector<HTMLElement>('[data-home-motion]');
  const isPending = () => openingPending() || hero?.hasAttribute('data-opening') === true;
  let complete = !isPending();
  const listeners = new Set<() => void>();
  if (!complete) {
    const observer = new MutationObserver(() => {
      if (isPending()) return;
      observer.disconnect();
      complete = true;
      listeners.forEach((update) => update());
      listeners.clear();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-opening-pending'],
    });
    if (hero) observer.observe(hero, { attributes: true, attributeFilter: ['data-opening'] });
  }

  return {
    get complete() {
      return complete;
    },
    onComplete(callback: () => void) {
      if (complete) callback();
      else listeners.add(callback);
    },
  };
}
