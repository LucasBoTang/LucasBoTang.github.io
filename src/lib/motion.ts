// Helpers that decide whether progressive-enhancement motion should run.

/** A fresh query for the visitor's reduced-motion preference. */
export function reducedMotionQuery(): MediaQueryList {
  return matchMedia('(prefers-reduced-motion: reduce)');
}

/** Why `watchActivity` is reporting: targets moved in or out of view, the tab was hidden or shown, or the motion preference changed. */
type ActivityReason = 'viewport' | 'page' | 'preference';

interface Activity<T extends Element> {
  reason: ActivityReason;
  /** Targets currently in view; every target when IntersectionObserver is unavailable. */
  inView: ReadonlySet<T>;
  /** The tab is in the background. */
  hidden: boolean;
  /** The visitor prefers reduced motion. */
  reduced: boolean;
}

/**
 * Reports each change that decides whether an animation should run. Viewport changes arrive
 * once per observer batch. `threshold` is the visible fraction that counts as in view.
 */
export function watchActivity<T extends Element>(
  targets: T | T[],
  onChange: (activity: Activity<T>) => void,
  { threshold = 0 }: { threshold?: number } = {},
): void {
  const list = Array.isArray(targets) ? targets : [targets];
  const reducedMotion = reducedMotionQuery();
  const inView = new Set<T>();
  const report = (reason: ActivityReason) =>
    onChange({ reason, inView, hidden: document.hidden, reduced: reducedMotion.matches });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as T;
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) inView.add(target);
          else inView.delete(target);
        }
        report('viewport');
      },
      { threshold: threshold > 0 ? [0, threshold] : 0 },
    );
    list.forEach((target) => observer.observe(target));
  } else {
    list.forEach((target) => inView.add(target));
    queueMicrotask(() => report('viewport'));
  }
  document.addEventListener('visibilitychange', () => report('page'));
  reducedMotion.addEventListener('change', () => report('preference'));
}
