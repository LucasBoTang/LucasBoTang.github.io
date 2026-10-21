import { createLoop } from '../../../lib/loop';
import { burstDuration, SIGNAL_INTERVAL, slipDuration } from '../../../lib/signal';
import { currentPortraitTiming, openingEvents } from '../opening/opening';
import { nameScrambleDuration } from './name-scramble';
import { createPortraitSignalRenderer } from './portrait-signal-renderer';

// The portrait's lower third in blue ink, on a canvas, and its signal: a tear of displaced
// scanlines and split colour channels, with snow. It tears once through the name's decode in the
// opening, then in short bursts every few seconds, and on demand while the visitor points at the
// portrait or the name. A light snow always falls on the blue, thicker while it is pointed at. The
// name glitches with each burst, through `data-slip` on the hero.

/** Idle bursts come `interval` apart, in milliseconds. The first waits until `afterIntro` past the
 * typed introduction, so it never lands on the end of the opening; if the introduction never
 * types, it comes `first` into the loop instead. A burst's tear plays over the signal's burst, and
 * lasts as long as the name's. */
const IDLE = { first: 12000, afterIntro: 2000, interval: SIGNAL_INTERVAL };
/** Frames are painted at most this often, except through the opening. */
const PAINT_INTERVAL = 1000 / 30;

/** Coordinates the portrait's opening, hover bursts and motion lifecycle. */
export function createPortraitSignal(hero: HTMLElement) {
  const time = currentPortraitTiming();
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-portrait-signal]');
  const image = hero.querySelector<HTMLImageElement>('.portrait');
  if (!canvas || !image) return { setRunning: () => {} };
  const renderer = createPortraitSignalRenderer(canvas, image);
  if (!renderer) return { setRunning: () => {} };
  const burst = { ...IDLE, pattern: burstDuration(), length: slipDuration() };
  const letters = (hero.querySelector('.name-base')?.textContent ?? '').replace(/\s/g, '').length;
  const decodeEnd = time.tearStart + nameScrambleDuration(letters);
  let ready = false;
  let identityHovered = false;
  let burstStarted: number | null = null;
  let nextBurstAt = burst.first;
  let wasOpening = false;
  let lastPaint = -Infinity;
  const loop = createLoop((clock) => {
    // Frame times are coarse, so a millisecond's slack keeps the frames evenly spaced.
    if (hero.hasAttribute('data-opening') || clock - lastPaint >= PAINT_INTERVAL - 1) {
      draw(clock);
      lastPaint = clock;
    }
  });

  // The portrait and the overhanging name, with its shifted blue copy, are one hover region.
  const setIdentityHover = (hovered: boolean) => {
    if (hovered === identityHovered) return;
    identityHovered = hovered;
    if (hovered && loop.running && !hero.hasAttribute('data-opening')) {
      // Name and photograph share this clock, including bursts the pointer starts.
      nextBurstAt = burstStarted === null ? loop.elapsed : Infinity;
      lastPaint = -Infinity;
    } else if (!hovered) {
      // Let the current tear settle, then give the idle rhythm a fresh full interval.
      nextBurstAt = loop.elapsed + burst.interval;
    }
  };
  const identity = hero.querySelector<HTMLElement>('.portrait-block');
  identity?.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch') setIdentityHover(true);
  });
  identity?.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch') setIdentityHover(false);
  });
  identity?.addEventListener('pointercancel', () => setIdentityHover(false));
  hero.addEventListener(
    openingEvents.introComplete,
    () => {
      if (burstStarted === null && !identityHovered) nextBurstAt = loop.elapsed + IDLE.afterIntro;
    },
    { once: true },
  );

  void renderer.ready.then((loaded) => {
    if (!loaded) return;
    ready = true;
    canvas.setAttribute('data-image-ready', '');
    draw(0);
  });

  /** Draws the frame at `clock`, the loop's time in milliseconds. */
  const draw = (clock: number) => {
    if (!ready) return;
    const opening = hero.hasAttribute('data-opening');
    if (wasOpening && !opening && identityHovered) nextBurstAt = clock;
    wasOpening = opening;
    const openingTime = hero.dataset.openingStarted
      ? performance.now() - Number(hero.dataset.openingStarted)
      : 0;
    if (loop.running && !opening) {
      if (burstStarted !== null && clock - burstStarted >= burst.length) {
        nextBurstAt = identityHovered
          ? Infinity
          : Math.max(nextBurstAt, burstStarted + burst.interval);
        burstStarted = null;
      }
      if (burstStarted === null && clock >= nextBurstAt) {
        burstStarted = clock;
        nextBurstAt = identityHovered ? Infinity : clock + burst.interval;
      }
    }
    // The opening's tear runs as long as the name decodes, past the shift that ends the opening.
    const decoding =
      !!hero.dataset.openingStarted && openingTime > time.tearStart && openingTime < decodeEnd;
    const tearing = loop.running && (decoding || (!opening && burstStarted !== null));
    hero.toggleAttribute('data-slip', tearing && !decoding);
    const phase = decoding
      ? (openingTime - time.tearStart) / (decodeEnd - time.tearStart)
      : (clock - (burstStarted ?? clock)) / burst.pattern;
    renderer.draw({
      clock,
      originalColour: opening && openingTime < time.blueEnd,
      tear: tearing ? { phase, decoding } : null,
      snow: !loop.running ? 'none' : !opening && identityHovered ? 'hovered' : 'resting',
    });
  };

  /** Starts or stops the signal; while stopped, the portrait rests on its blue, untorn. */
  function setRunning(enabled: boolean) {
    if (!hero.isConnected) enabled = false;
    if (enabled === loop.running) return;
    if (enabled) {
      if (identityHovered && !hero.hasAttribute('data-opening')) nextBurstAt = loop.elapsed;
      loop.start();
    } else {
      loop.stop();
      burstStarted = null;
      nextBurstAt = loop.elapsed + burst.interval;
      hero.removeAttribute('data-slip');
      draw(0);
    }
  }
  return { setRunning };
}
