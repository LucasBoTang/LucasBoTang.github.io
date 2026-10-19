import { arrival } from './arrival';

// A small sequencing layer for page openings: animations are created paused, grouped by name,
// and started together; timers and viewport waits stop as soon as the opening is finished.

/** An observer margin that makes everything above the screen count as in view. */
const SEEN_ABOVE = '100000px 0px 0px 0px';

export interface Timeline<Group extends string> {
  /** Adds a paused animation to `group`. Missing elements are ignored. */
  animate(
    element: Element | null,
    frames: Keyframe[],
    timing: { duration: number; delay?: number; easing?: string },
    group: Group,
  ): void;
  /** Adds a paused fade-in to `group`. */
  appear(element: Element | null, delay: number, group: Group, duration: number): void;
  /** Plays every animation in `group`, once. */
  start(group: Group): void;
  /** Runs `callback` after `delay` unless the timeline has finished. */
  later(callback: () => void, delay: number): void;
  /** Runs `callback` once `element` is (or comes) on screen. */
  whenVisible(element: Element | null, callback: () => void): void;
  /** Cancels every animation, timer and viewport wait. */
  finish(): void;
  readonly finished: boolean;
}

export function createTimeline<Group extends string>(): Timeline<Group> {
  const animations: Animation[] = [];
  const groups = new Map<Group, Animation[]>();
  const startedGroups = new Set<Group>();
  const timers: number[] = [];
  const observers: IntersectionObserver[] = [];
  let finished = false;

  const timeline: Timeline<Group> = {
    animate(element, frames, { duration, delay = 0, easing = 'ease' }, group) {
      if (!element) return;
      // Held at its first frame through the delay, so nothing shows before it starts.
      const animation = element.animate(frames, { duration, delay, easing, fill: 'backwards' });
      animation.pause();
      animations.push(animation);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(animation);
    },
    appear(element, delay, group, duration) {
      timeline.animate(
        element,
        [{ opacity: 0 }, { opacity: 1 }],
        { duration, delay, easing: arrival.fadeEasing },
        group,
      );
    },
    start(group) {
      if (finished || startedGroups.has(group)) return;
      startedGroups.add(group);
      groups.get(group)?.forEach((animation) => animation.play());
    },
    later(callback, delay) {
      timers.push(
        window.setTimeout(() => {
          if (!finished) callback();
        }, delay),
      );
    },
    whenVisible(element, callback) {
      if (!element) return;
      if (
        element.getBoundingClientRect().top < window.innerHeight ||
        !('IntersectionObserver' in window)
      ) {
        callback();
        return;
      }
      // The watched area reaches up without end, so an element the visitor has scrolled past counts
      // as seen, even if a jump carried it past without it ever crossing the screen.
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          callback();
        },
        { threshold: 0.05, rootMargin: SEEN_ABOVE },
      );
      observers.push(observer);
      observer.observe(element);
    },
    finish() {
      finished = true;
      timers.forEach(window.clearTimeout);
      animations.forEach((animation) => animation.cancel());
      observers.forEach((observer) => observer.disconnect());
    },
    get finished() {
      return finished;
    },
  };
  return timeline;
}
