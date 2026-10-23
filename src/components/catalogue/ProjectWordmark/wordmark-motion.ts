import { ARRIVAL_EVENT } from '../../../lib/arrival';
import { enhance } from '../../../lib/lifecycle';
import { reducedMotionQuery, watchActivity } from '../../../lib/motion';
import {
  BEAM_FRAMES,
  ECHO_FRAMES,
  HANDOVER,
  IN_VIEW_BEAT,
  IN_VIEW_SHARE,
  PICTURE_FRAMES,
  POWER_ON,
  POWER_ON_DELAY,
} from './wordmark-entrance.ts';

// Each project wordmark is a signal that never quite holds. It trembles in short phrases: for a
// moment, on every redraw, one or two thin bands torn at random through the letters slip a few
// pixels sideways, and now and then a faint light copy of the word splits off, as a colour
// channel would; the phrase comes in quickly and fades, and after a breath of clean signal, never
// long, the next one begins. Each wordmark keeps its own phrases and rhythm, so they never move
// together. Pointing at the wordmark's entry (its nearest ancestor marked `data-project-host`), or
// moving into it from the keyboard, tunes the signal in: the word holds clean until the pointer or
// focus leaves. Off screen, in a background tab, or with reduced motion, wordmarks keep still.
//
// As its entry arrives, the word switches on as an old television does: a dot of light blue snaps
// on in the middle of its letters and shoots out into a line the word's width; the line is the
// word itself, squashed flat, and it springs open up and down, a little past its height and back,
// bright at first and settling to its own blue. It opens trembling: a strong phrase of the tremor
// starts the moment it is open, as if the signal were still finding itself, and fades as the
// picture settles.

/** Each redraw of the tremor comes this long after the last, in milliseconds, at random, so each
 * wordmark trembles in its own rhythm; it tears `BANDS` thin bands through the letters, each
 * `BAND_HEIGHT` of their ink tall and slipped up to `SHIFT` pixels, and leaves the word clean with
 * `CLEAN_CHANCE`. */
const STEP = [34, 62];
const BANDS = [1, 2];
const BAND_HEIGHT = [0.05, 0.12];
const SHIFT = [2, 5];
const CLEAN_CHANCE = 0.2;
/** On some redraws a faint light copy splits off by a pixel or so. */
const SPLIT = [1, 1.5];
const SPLIT_CHANCE = 0.4;
/** A phrase of tremor lasts this long, in milliseconds, at random, and the clean breath after it
 * this long. */
const PHRASE = [250, 900];
const BREATH = [150, 700];
/** A phrase reaches full strength over this share of it, and fades over the rest. */
const PHRASE_RISE = 0.2;
/** The phrase a word opens with lasts this long, in milliseconds, at full strength from the
 * start. */
const OPENING_PHRASE = [600, 900];

const between = ([low, high]: number[]) => low + Math.random() * (high - low);
const sign = () => (Math.random() < 0.5 ? -1 : 1);
const textMeasure = document.createElement('canvas').getContext('2d');

/** Where the word's letters have ink, as shares of its line from the top: the line also holds
 * empty space above and below, which a tear must miss. */
function inkOf(glyphs: HTMLElement, face: HTMLElement) {
  const word = glyphs.getBoundingClientRect();
  const style = getComputedStyle(glyphs);
  if (!textMeasure || !word.height) return { top: 0.25, bottom: 0.75 };
  textMeasure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const metrics = textMeasure.measureText(face.textContent ?? '');
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;
  if (!Number.isFinite(ascent) || !Number.isFinite(descent)) return { top: 0.25, bottom: 0.75 };
  const baseline = (word.height - ascent - descent) / 2 + ascent;
  return {
    top: (baseline - metrics.actualBoundingBoxAscent) / word.height,
    bottom: (baseline + metrics.actualBoundingBoxDescent) / word.height,
  };
}

function setupWordmark(node: HTMLElement) {
  const glyphs = node.querySelector<HTMLElement>(':scope > .project-glyphs');
  const face = glyphs?.querySelector<HTMLElement>('.project-face');
  const echo = glyphs?.querySelector<HTMLElement>('.project-echo');
  if (!glyphs || !face || !echo) return;
  const host = node.closest<HTMLElement>('[data-project-host]') ?? node;
  const reducedMotion = reducedMotionQuery();
  // A layer for each band a redraw can tear.
  const bands = Array.from({ length: BANDS[1] }, () => {
    const band = document.createElement('span');
    band.className = 'project-band';
    band.setAttribute('aria-hidden', 'true');
    band.textContent = face.textContent;
    glyphs.append(band);
    return band;
  });
  // The beam a power-on snaps on; it waits hidden at the middle of the letters.
  const beam = document.createElement('span');
  beam.className = 'project-beam';
  beam.setAttribute('aria-hidden', 'true');
  glyphs.append(beam);
  // Measured when first needed, not as the page loads, and again whenever the word may have
  // changed size.
  let measured: ReturnType<typeof inkOf> | undefined;
  const ink = () => (measured ??= inkOf(glyphs, face));
  new ResizeObserver(() => (measured = undefined)).observe(glyphs);
  void document.fonts.ready.then(() => (measured = undefined));

  let running = false;
  let poweredAt = 0;
  let pointed = false;
  let tuned = false;
  let frame = 0;
  let disturbed = false;

  const settle = () => {
    node.removeAttribute('data-glitching');
    disturbed = false;
    face.style.maskImage = '';
    echo.removeAttribute('style');
    bands.forEach((band) => {
      band.removeAttribute('data-torn');
      band.removeAttribute('style');
    });
  };

  // When this wordmark's next redraw is due, and its current phrase, or breath.
  let due = 0;
  let phrase: { from: number; to: number; rise: number } | undefined;
  let breathUntil = 0;

  /** Draws one redraw of the tremor at `strength`, from 0 to 1. */
  const draw = (strength: number) => {
    const { top: inkTop, bottom: inkBottom } = ink();
    const span = inkBottom - inkTop;
    const percent = (share: number) => `${(share * 100).toFixed(1)}%`;
    // Thin bands at random through the ink, kept apart so each reads on its own.
    const torn: [number, number][] = [];
    const count = Math.random() < CLEAN_CHANCE ? 0 : Math.round(between(BANDS));
    for (let tries = 0; torn.length < count && tries < 12; tries++) {
      const height = between(BAND_HEIGHT) * span;
      const top = inkTop + Math.random() * (span - height);
      if (torn.some(([t, b]) => top < b + 0.02 && top + height > t - 0.02)) continue;
      torn.push([top, top + height]);
    }
    torn.sort((a, b) => a[0] - b[0]);
    const stops = torn.flatMap(([top, bottom]) => [
      `black ${percent(top)}`,
      `transparent ${percent(top)}`,
      `transparent ${percent(bottom)}`,
      `black ${percent(bottom)}`,
    ]);
    face.style.maskImage = stops.length ? `linear-gradient(to bottom, ${stops.join(', ')})` : '';
    bands.forEach((band, index) => {
      const tear = torn[index];
      band.toggleAttribute('data-torn', !!tear);
      if (!tear) return;
      const shift = between(SHIFT) * Math.max(0.3, strength) * sign();
      band.style.clipPath = `inset(${percent(tear[0])} -40px ${percent(1 - tear[1])} -40px)`;
      band.style.transform = `translateX(${shift.toFixed(1)}px)`;
    });
    if (torn.length && Math.random() < SPLIT_CHANCE) {
      echo.style.clipPath = 'none';
      echo.style.color = 'var(--signal-light)';
      echo.style.opacity = (0.12 + 0.2 * strength).toFixed(3);
      echo.style.transform = `translateX(${(between(SPLIT) * sign()).toFixed(1)}px)`;
    } else echo.removeAttribute('style');
    const now = torn.length > 0;
    if (now !== disturbed) node.toggleAttribute('data-glitching', (disturbed = now));
  };

  const loop = (time: number) => {
    frame = requestAnimationFrame(loop);
    if (time < due || time < poweredAt) return;
    due = time + between(STEP);
    if (!phrase) {
      if (time < breathUntil) return;
      phrase = { from: time, to: time + between(PHRASE), rise: PHRASE_RISE };
    }
    if (time >= phrase.to) {
      phrase = undefined;
      breathUntil = time + between(BREATH);
      settle();
      return;
    }
    const progress = (time - phrase.from) / (phrase.to - phrase.from);
    const { rise } = phrase;
    draw(progress < rise ? progress / rise : 1 - (progress - rise) / (1 - rise));
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    phrase = undefined;
    breathUntil = 0;
    settle();
  };
  /** Runs the tremor while the wordmark is on screen and not tuned in. */
  const resume = () => {
    if (!running || tuned) {
      stop();
      return;
    }
    if (!frame) frame = requestAnimationFrame(loop);
  };

  // Pointing at the entry, keyboard focus inside it, or on a screen without hover the entry being
  // read (`data-focused`, src/lib/lit-focus.ts) tunes the signal in. A link clicked inside keeps
  // focus but is not keyboard focus, so it does not hold the word still; a touch is not pointing,
  // as it leaves the moment it lands.
  const tune = () => {
    const now =
      pointed || host.hasAttribute('data-focused') || host.matches(':has(:focus-visible)');
    if (now === tuned) return;
    tuned = now;
    if (tuned) stop();
    else resume();
  };
  host.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    pointed = true;
    tune();
  });
  host.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return;
    pointed = false;
    tune();
  });
  new MutationObserver(tune).observe(host, { attributes: true, attributeFilter: ['data-focused'] });
  host.addEventListener('focusin', tune);
  host.addEventListener('focusout', () => requestAnimationFrame(tune));

  /** The power-on waiting for the word to come into view: its animations, held dark, and the
   * earliest moment it may start. */
  let waiting: { animations: Animation[]; earliest: number } | undefined;
  /** The share of the word inside the window right now, read directly rather than waiting for the
   * observer's first report, which may come after the word's arrival. */
  const shareInView = () => {
    const box = node.getBoundingClientRect();
    const visible = Math.min(box.bottom, innerHeight) - Math.max(box.top, 0);
    return box.height > 0 ? Math.max(0, visible) / box.height : 0;
  };
  /** Starts the power-on `delay` milliseconds from now; the word trembles once it is open. */
  const powerOn = (animations: Animation[], delay: number) => {
    poweredAt = performance.now() + delay + POWER_ON * (HANDOVER + 0.05);
    phrase = { from: poweredAt, to: poweredAt + between(OPENING_PHRASE), rise: 0 };
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
        const { animations, earliest } = waiting;
        waiting = undefined;
        powerOn(animations, Math.max(earliest - performance.now(), IN_VIEW_BEAT));
      },
      { threshold: [0, IN_VIEW_SHARE] },
    ).observe(node);
  }

  host.addEventListener(ARRIVAL_EVENT, (event) => {
    if (reducedMotion.matches || !Element.prototype.animate) return;
    const delay = (event as CustomEvent<{ delay: number }>).detail.delay + POWER_ON_DELAY;
    const earliest = performance.now() + delay;
    due = 0;
    settle();
    const { top: inkTop, bottom: inkBottom } = ink();
    const middle = `${(((inkTop + inkBottom) / 2) * 100).toFixed(1)}%`;
    beam.style.top = middle;
    face.style.transformOrigin = `center ${middle}`;
    const animations = [
      beam.animate(BEAM_FRAMES, { duration: POWER_ON, delay, fill: 'backwards' }),
      face.animate(PICTURE_FRAMES, { duration: POWER_ON, delay, fill: 'backwards' }),
      echo.animate(ECHO_FRAMES, { duration: POWER_ON, delay, fill: 'backwards' }),
    ];
    if (shareInView() >= IN_VIEW_SHARE) {
      powerOn(animations, delay);
      return;
    }
    // Out of sight: held at their start, the word stays dark until it is seen.
    animations.forEach((animation) => animation.pause());
    poweredAt = Infinity;
    waiting = { animations, earliest };
  });

  watchActivity(node, (activity) => {
    running = activity.inView.size > 0 && !activity.hidden && !activity.reduced;
    if (running) resume();
    else stop();
    if (activity.reduced) {
      // Cancelling restores the static word, including an offscreen entrance held at its dark frame.
      waiting = undefined;
      poweredAt = 0;
      [beam, face, echo].forEach((layer) =>
        layer.getAnimations().forEach((animation) => animation.cancel()),
      );
    }
  });
}

enhance('.project-wordmark', setupWordmark);
