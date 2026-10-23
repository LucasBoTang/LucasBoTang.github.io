import { ARRIVAL_EVENT } from '../../../lib/arrival';
import { enhance } from '../../../lib/lifecycle';
import { reducedMotionQuery, watchActivity } from '../../../lib/motion';
import {
  HANDOVER,
  IN_VIEW_BEAT,
  IN_VIEW_SHARE,
  POWER_ON,
  POWER_ON_DELAY,
} from './wordmark-entrance.ts';
import { createWordmarkRenderer } from './wordmark-renderer.ts';

// Each wordmark opens as a television signal, then trembles in independent short phrases.
// Home keeps trembling until its preview connects; other entries hold clean while selected.
// Viewport, tab visibility and reduced motion control playback without changing the drawing.

/** Redraw intervals in milliseconds; each wordmark keeps its own uneven rhythm. */
const STEP_MS = [34, 62];
/** A phrase of tremor lasts this long, in milliseconds, at random, and the clean breath after it
 * this long. */
const PHRASE_MS = [250, 900];
const BREATH_MS = [150, 700];
/** A phrase reaches full strength over this share of it, and fades over the rest. */
const PHRASE_RISE = 0.2;
/** The phrase a word opens with lasts this long, in milliseconds, at full strength from the
 * start. */
const OPENING_PHRASE_MS = [600, 900];

const between = ([low, high]: number[]) => low + Math.random() * (high - low);

function setupWordmark(node: HTMLElement) {
  const renderer = createWordmarkRenderer(node);
  if (!renderer) return;
  const host = node.closest<HTMLElement>('[data-project-host]') ?? node;
  const preview = node.closest<HTMLElement>('[data-figure-preview]');
  const reducedMotion = reducedMotionQuery();
  let active = false;
  let tremorStartsAt = 0;
  let hovered = false;
  let tuned = false;
  let frameId = 0;

  // Absolute frame-clock times in milliseconds, including the current phrase or clean breath.
  let nextDrawAt = 0;
  let phrase: { startsAt: number; endsAt: number; rise: number } | undefined;
  let breathUntil = 0;

  const loop = (time: number) => {
    frameId = requestAnimationFrame(loop);
    if (time < nextDrawAt || time < tremorStartsAt) return;
    nextDrawAt = time + between(STEP_MS);
    if (!phrase) {
      if (time < breathUntil) return;
      phrase = { startsAt: time, endsAt: time + between(PHRASE_MS), rise: PHRASE_RISE };
    }
    if (time >= phrase.endsAt) {
      phrase = undefined;
      breathUntil = time + between(BREATH_MS);
      renderer.settle();
      return;
    }
    const progress = (time - phrase.startsAt) / (phrase.endsAt - phrase.startsAt);
    const { rise } = phrase;
    renderer.draw(progress < rise ? progress / rise : 1 - (progress - rise) / (1 - rise));
  };
  const stop = () => {
    cancelAnimationFrame(frameId);
    frameId = 0;
    phrase = undefined;
    breathUntil = 0;
    renderer.settle();
  };
  /** Runs the tremor while the wordmark is on screen and not tuned in. */
  const resume = () => {
    if (!active || tuned) {
      stop();
      return;
    }
    if (!frameId) frameId = requestAnimationFrame(loop);
  };

  // Home selection starts loading, but the waiting word keeps its signal until acquisition
  // takes over. Other entries still tune in on pointer, keyboard or reading focus (`data-focused`).
  // Click focus and touch alone do not hold those entries still.
  const tune = () => {
    const now = preview
      ? preview.hasAttribute('data-preview-visible')
      : hovered || host.hasAttribute('data-focused') || host.matches(':has(:focus-visible)');
    if (now === tuned) return;
    tuned = now;
    if (tuned) stop();
    else resume();
  };
  host.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    hovered = true;
    tune();
  });
  host.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return;
    hovered = false;
    tune();
  });
  new MutationObserver(tune).observe(host, { attributes: true, attributeFilter: ['data-focused'] });
  host.addEventListener('focusin', tune);
  host.addEventListener('focusout', () => requestAnimationFrame(tune));
  if (preview) {
    new MutationObserver(tune).observe(preview, {
      attributes: true,
      attributeFilter: ['data-preview-visible'],
    });
    tune();
  }

  /** The power-on waiting for the word to come into view: its animations, held dark, and the
   * earliest moment it may start. */
  let waiting: { animations: Animation[]; earliestStartAt: number } | undefined;
  /** The share of the word inside the window right now, read directly rather than waiting for the
   * observer's first report, which may come after the word's arrival. */
  const shareInView = () => {
    const box = node.getBoundingClientRect();
    const visible = Math.min(box.bottom, innerHeight) - Math.max(box.top, 0);
    return box.height > 0 ? Math.max(0, visible) / box.height : 0;
  };
  /** Starts the power-on `delay` milliseconds from now; the word trembles once it is open. */
  const powerOn = (animations: Animation[], delay: number) => {
    tremorStartsAt = performance.now() + delay + POWER_ON * (HANDOVER + 0.05);
    phrase = {
      startsAt: tremorStartsAt,
      endsAt: tremorStartsAt + between(OPENING_PHRASE_MS),
      rise: 0,
    };
    animations.forEach((animation) => {
      animation.effect?.updateTiming({ delay });
      animation.currentTime = 0;
      animation.play();
    });
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio < IN_VIEW_SHARE || !waiting) return;
        const { animations, earliestStartAt } = waiting;
        waiting = undefined;
        powerOn(animations, Math.max(earliestStartAt - performance.now(), IN_VIEW_BEAT));
      },
      { threshold: [0, IN_VIEW_SHARE] },
    ).observe(node);
  }

  host.addEventListener(ARRIVAL_EVENT, (event) => {
    if (reducedMotion.matches || !Element.prototype.animate) return;
    const delay = (event as CustomEvent<{ delay: number }>).detail.delay + POWER_ON_DELAY;
    const earliestStartAt = performance.now() + delay;
    nextDrawAt = 0;
    renderer.settle();
    const animations = renderer.prepareEntrance(delay);
    if (shareInView() >= IN_VIEW_SHARE) {
      powerOn(animations, delay);
      return;
    }
    // Out of sight: held at their start, the word stays dark until it is seen.
    animations.forEach((animation) => animation.pause());
    tremorStartsAt = Infinity;
    waiting = { animations, earliestStartAt };
  });

  watchActivity(node, (activity) => {
    active = activity.inView.size > 0 && !activity.hidden && !activity.reduced;
    if (active) resume();
    else stop();
    if (activity.reduced) {
      // Cancelling restores the static word, including an offscreen entrance held at its dark frame.
      waiting = undefined;
      tremorStartsAt = 0;
      renderer.cancelEntrance();
    }
  });
}

enhance('.project-wordmark', setupWordmark);
