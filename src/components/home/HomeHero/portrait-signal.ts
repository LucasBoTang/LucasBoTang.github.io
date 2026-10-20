import { whenIdle } from '../../../lib/lifecycle';
import { createLoop } from '../../../lib/loop';
import { burstDuration, SIGNAL_INTERVAL, slipDuration } from '../../../lib/signal';
import { openingEvents, openingTiming as time } from '../opening/opening';
import { printInBlueInk } from './blue-ink';
import { nameScrambleDuration } from './name-scramble';
import { canvasOf } from './raster';

// The portrait's lower third in blue ink, on a canvas, and its signal: a tear of displaced
// scanlines and split colour channels, with snow. It tears once through the name's decode in the
// opening, then in short bursts every few seconds, and on demand while the visitor points at the
// portrait or the name. A light snow always falls on the blue, thicker while it is pointed at. The
// name glitches with each burst, through `data-slip` on the hero.

/** The lower third of the photograph is sampled at this size, and drawn at `SCALE` times it. */
const SAMPLE = { width: 256, height: 128 };
const SCALE = 2;
/** Idle bursts come `interval` apart, in milliseconds. The first waits until `afterIntro` past the
 * typed introduction, so it never lands on the end of the opening; if the introduction never
 * types, it comes `first` into the loop instead. A burst's tear plays over the signal's burst, and
 * lasts as long as the name's. */
const IDLE = { first: 12000, afterIntro: 2000, interval: SIGNAL_INTERVAL };
/** Frames are painted at most this often, except through the opening. */
const PAINT_INTERVAL = 1000 / 30;
/** How strong the tear is through the opening and through a burst, as [until phase, strength]. */
const OPENING_STRENGTH: [number, number][] = [
  [0.12, 0.5],
  [0.48, 1],
  [0.7, 0.45],
  [0.86, 0.15],
];
const BURST_STRENGTH: [number, number][] = [
  [0.12, 0],
  [0.42, 0.7],
  [0.62, 0],
  [0.82, 0.4],
];
/** Through the name's decode, the torn rows slip in alternate directions, each row against its
 * neighbours, and swap sides this many times over the decode. */
const DECODE_SWAPS = 6;
/** A burst tears one way, then rebounds the other way from this phase. */
const REBOUND = 0.62;
/** How far each colour channel is shifted, in sample pixels, through the opening and a burst. */
const CHANNEL_SHIFT = { opening: [1, 7, 16], burst: [-3.5, 0.5, 4] };
/** The rows the tear displaces, in sample pixels, through the opening and a burst. */
const TEAR = {
  opening: [
    { top: 19, height: 9, shift: 11, stretch: 0.014 },
    { top: 54, height: 22, shift: 26, stretch: 0.025 },
    { top: 96, height: 4, shift: 16, stretch: 0.01 },
  ],
  burst: [
    { top: 23, height: 5, shift: -3, stretch: -0.006 },
    { top: 59, height: 13, shift: 5, stretch: 0.012 },
    { top: 92, height: 3, shift: -4, stretch: 0.004 },
  ],
};
/** Snow specks per frame through the opening, in a burst, while pointed at and at rest, and the
 * strength of the snow while pointed at and at rest: a light snow always falls on the blue, and
 * pointing thickens it. */
const SNOW = {
  opening: 360,
  burst: 1400,
  hovered: 2800,
  hoveredStrength: 0.7,
  resting: 1600,
  restingStrength: 0.5,
};
/** The snow changes every `SNOW_STEP` milliseconds. At rest it replays a cycle of `RESTING_FRAMES`
 * frames, each drawn once, too quick for the cycle to be seen; thicker snow is drawn live. */
const SNOW_STEP = 42;
const RESTING_FRAMES = 12;
/** Canvas colours: snow's light and dark specks, and the gap behind a displaced row. */
const SNOW_LIGHT = 'rgb(166,193,224)';
const SNOW_DARK = 'rgb(3,8,16)';
const TEAR_GAP = '#080e18';

const stepAt = (steps: [number, number][], phase: number) =>
  steps.find(([until]) => phase < until)?.[1] ?? 0;
const sampleCanvas = () => canvasOf(SAMPLE.width, SAMPLE.height);

/** Draws the portrait signal on `[data-portrait-signal]` in `hero`. */
export function createPortraitSignal(hero: HTMLElement) {
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-portrait-signal]');
  const context = canvas?.getContext('2d');
  const image = hero.querySelector<HTMLImageElement>('.portrait');
  const tinted = sampleCanvas();
  const tintedContext = tinted.getContext('2d');
  if (!canvas || !context || !image || !tintedContext) return { setRunning: () => {} };
  const { width, height } = SAMPLE;
  const burst = { ...IDLE, pattern: burstDuration(), length: slipDuration() };
  const letters = (hero.querySelector('.name-base')?.textContent ?? '').replace(/\s/g, '').length;
  const decodeEnd = time.tearStart + nameScrambleDuration(letters);
  const natural = sampleCanvas();
  const naturalContext = natural.getContext('2d');
  const separated = sampleCanvas();
  const separatedContext = separated.getContext('2d');
  // Each colour channel alone, of the blue and of the natural photograph.
  const tintedChannels: HTMLCanvasElement[] = [];
  const naturalChannels: HTMLCanvasElement[] = [];
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  context.scale(SCALE, SCALE);

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

  const sampling = new Image();
  sampling.src = image.currentSrc || image.src;
  void sampling
    .decode()
    .then(() => {
      const { naturalWidth, naturalHeight } = sampling;
      tintedContext.drawImage(
        sampling,
        0,
        (naturalHeight * 2) / 3,
        naturalWidth,
        naturalHeight / 3,
        0,
        0,
        width,
        height,
      );
      naturalContext?.drawImage(tinted, 0, 0);
      const pixels = tintedContext.getImageData(0, 0, width, height);
      const naturalPixels = new Uint8ClampedArray(pixels.data);
      printInBlueInk(pixels.data);
      tintedContext.putImageData(pixels, 0, 0);
      ready = true;
      canvas.setAttribute('data-image-ready', '');
      draw(0);
      // The tear's colour channels are first needed as the name decodes, well after the page has
      // shown, so they are made while the browser is idle rather than as it loads.
      whenIdle(() => {
        // Cache the actual RGB channels of the blue photograph, not coloured noise.
        for (let channel = 0; channel < 3; channel++) {
          const layer = sampleCanvas();
          const layerContext = layer.getContext('2d');
          if (!layerContext) continue;
          const data = layerContext.createImageData(width, height);
          for (let i = 0; i < pixels.data.length; i += 4) {
            data.data[i + channel] = pixels.data[i + channel];
            data.data[i + 3] = 255;
          }
          layerContext.putImageData(data, 0, 0);
          tintedChannels.push(layer);
          const naturalLayer = sampleCanvas();
          const naturalLayerContext = naturalLayer.getContext('2d');
          if (naturalLayerContext) {
            for (let i = 0; i < data.data.length; i += 4)
              data.data[i + channel] = naturalPixels[i + channel];
            naturalLayerContext.putImageData(data, 0, 0);
            naturalChannels.push(naturalLayer);
          }
        }
      });
    })
    .catch(() => {
      // The blue image drawn by HomeHero's SVG filter remains as the fallback.
    });

  /** Scatters `count` specks of snow over `target`, from `seed`. */
  const speckle = (
    target: CanvasRenderingContext2D,
    seed: number,
    strength: number,
    count: number,
  ) => {
    const noise = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < count; i++) {
      const x = noise() * width;
      const y = noise() * height;
      const light = noise() > 0.35;
      target.fillStyle = light ? SNOW_LIGHT : SNOW_DARK;
      target.globalAlpha = light ? strength * (0.18 + noise() * 0.38) : strength * 0.4;
      target.fillRect(x, y, 0.5 + noise() * 0.7, 0.5 + noise() * 0.4);
    }
    target.globalAlpha = 1;
  };
  const drawSnow = (clock: number, strength: number, count: number) =>
    speckle(context, Math.floor(clock / SNOW_STEP) + 71, strength, count);
  // The resting snow runs whenever the hero is on screen, so its frames are drawn once each, as
  // they are first needed, and then only copied.
  const restingFrames: HTMLCanvasElement[] = [];
  const drawRestingSnow = (clock: number) => {
    const index = Math.floor(clock / SNOW_STEP) % RESTING_FRAMES;
    if (!restingFrames[index]) {
      const frame = canvasOf(width * SCALE, height * SCALE);
      const frameContext = frame.getContext('2d');
      if (!frameContext) return drawSnow(clock, SNOW.restingStrength, SNOW.resting);
      frameContext.scale(SCALE, SCALE);
      speckle(frameContext, index + 71, SNOW.restingStrength, SNOW.resting);
      restingFrames[index] = frame;
    }
    context.drawImage(restingFrames[index], 0, 0, width, height);
  };

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
    const originalColour = opening && openingTime < time.blueEnd && !!naturalContext;
    context.drawImage(originalColour ? natural : tinted, 0, 0);
    const hoverSnow = loop.running && !opening && identityHovered;
    // A light snow always falls on the blue once it has come up; pointing thickens it.
    const restingSnow = loop.running && !originalColour;
    // Remap the photograph's scanlines while the name decodes and during the same bursts as the
    // name, with a brief, denser snow.
    const phase = decoding
      ? (openingTime - time.tearStart) / (decodeEnd - time.tearStart)
      : (clock - (burstStarted ?? clock)) / burst.pattern;
    const strength = tearing ? stepAt(decoding ? OPENING_STRENGTH : BURST_STRENGTH, phase) : 0;
    if (!strength) {
      if (hoverSnow) drawSnow(clock, SNOW.hoveredStrength, SNOW.hovered);
      else if (restingSnow) drawRestingSnow(clock);
      return;
    }
    const rebound = !decoding && phase >= REBOUND;
    const swap = Math.floor(phase * DECODE_SWAPS) % 2 ? -1 : 1;
    const direction = decoding ? swap : rebound ? -1 : phase < 0.26 ? 1 : -0.65;

    // The colour channels split apart, each repeating its edge pixel over the gap it leaves.
    const channels = originalColour ? naturalChannels : tintedChannels;
    if (separatedContext && channels.length === 3) {
      separatedContext.globalCompositeOperation = 'source-over';
      separatedContext.fillStyle = '#000';
      separatedContext.fillRect(0, 0, width, height);
      separatedContext.globalCompositeOperation = 'lighter';
      const split = decoding ? strength : rebound ? 0.55 : 1;
      (decoding ? CHANNEL_SHIFT.opening : CHANNEL_SHIFT.burst).forEach((shift, channel) => {
        const x = shift * direction * split;
        const layer = channels[channel];
        separatedContext.drawImage(layer, x, 0);
        if (x > 0) separatedContext.drawImage(layer, 0, 0, 1, height, 0, 0, x, height);
        if (x < 0)
          separatedContext.drawImage(layer, width - 1, 0, 1, height, width + x, 0, -x, height);
      });
      context.globalAlpha = 0.85;
      context.drawImage(separated, 0, 0);
      context.globalAlpha = 1;
    }

    // The torn rows, each bent and stretched, with colour breaking within the moving tear.
    (decoding ? TEAR.opening : TEAR.burst).forEach((band, index) => {
      const source = originalColour && (phase < 0.16 || band.top === 96) ? natural : tinted;
      const settle = decoding ? strength : rebound ? 0.65 : 1;
      // While the name decodes, neighbouring rows slip against each other.
      const sense = decoding && index % 2 ? -1 : 1;
      for (let row = 0; row < band.height; row++) {
        const y = band.top + row;
        const bend = Math.sin((row / band.height) * Math.PI) * 1.7;
        const offset = (band.shift + bend) * direction * sense * settle;
        const rowWidth = width * (1 + band.stretch * direction * sense * settle);
        // A repeated adjacent row adds a small vertical tracking error.
        const sourceY = y + (row > band.height * 0.55 ? (rebound ? -1 : 1) : 0);
        context.fillStyle = TEAR_GAP;
        context.fillRect(0, y, width, 1);
        context.drawImage(source, 0, sourceY, width, 1, offset, y, rowWidth, 1);
        // Extend the boundary pixel instead of leaving artificial black seams.
        if (offset > 0) context.drawImage(source, 0, sourceY, 1, 1, 0, y, offset, 1);
        const end = offset + rowWidth;
        if (end < width)
          context.drawImage(source, width - 1, sourceY, 1, 1, end, y, width - end, 1);
      }
    });
    const snow = decoding ? SNOW.opening : identityHovered ? SNOW.hovered : SNOW.burst;
    drawSnow(clock, hoverSnow ? Math.max(strength, SNOW.hoveredStrength) : strength, snow);
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
