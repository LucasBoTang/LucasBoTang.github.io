import { createPortraitSignalImage, SAMPLE } from './portrait-signal-image';
import { canvasOf } from './raster';

/** The display canvas draws at twice the sampled resolution. */
const SCALE = 2;
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

interface PortraitSignalFrame {
  clock: number;
  originalColour: boolean;
  tear: { phase: number; decoding: boolean } | null;
  snow: 'none' | 'resting' | 'hovered';
}

/** Owns image preparation, canvas drawing and cached snow frames; it does not schedule motion. */
export function createPortraitSignalRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const picture = createPortraitSignalImage(image);
  if (!picture) return;
  const { tinted, natural, tintedChannels, naturalChannels } = picture;
  const { width, height } = SAMPLE;
  const separated = canvasOf(width, height);
  const separatedContext = separated.getContext('2d');
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  context.scale(SCALE, SCALE);
  let shownStill: string | undefined;

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

  const draw = (frame: PortraitSignalFrame) => {
    const { clock, tear } = frame;
    const originalColour = frame.originalColour && picture.hasNatural;
    const hoverSnow = frame.snow === 'hovered';
    const restingSnow = frame.snow !== 'none' && !originalColour;
    const phase = tear?.phase ?? 0;
    const decoding = tear?.decoding ?? false;
    const strength = tear ? stepAt(decoding ? OPENING_STRENGTH : BURST_STRENGTH, phase) : 0;
    // Untorn, the canvas changes only with the snow's step, so a frame that would show the same
    // picture again is not painted.
    const still = strength
      ? undefined
      : `${originalColour} ${hoverSnow} ${restingSnow} ${Math.floor(clock / SNOW_STEP)}`;
    if (still !== undefined && still === shownStill) return;
    shownStill = still;
    context.drawImage(originalColour ? natural : tinted, 0, 0);
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
    const snow = decoding ? SNOW.opening : hoverSnow ? SNOW.hovered : SNOW.burst;
    drawSnow(clock, hoverSnow ? Math.max(strength, SNOW.hoveredStrength) : strength, snow);
  };
  return { ready: picture.ready, draw };
}
