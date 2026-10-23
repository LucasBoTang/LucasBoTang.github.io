import { whenIdle } from '../../../lib/lifecycle';
import { currentPortraitTiming } from '../opening/opening';
import { printInBlueInk } from './blue-ink';
import { createDevelopment, revealTimes } from './portrait-dither';
import { drawGlitchFrame, glitchFrames, type GlitchSources } from './portrait-glitch';
import { canvasOf, pixelsOf } from './raster';

// The portrait's entrance. The portrait is first a blue pixel picture, drawn from the photograph
// by `npm run portrait` (scripts/portrait-pixels.mjs), which develops in place as an ordered
// screen of dots (portrait-dither.ts). As soon as the portrait can be made out, it glitches into
// the photograph (portrait-glitch.ts).

/** The photograph in the blue ink is first drawn late in the glitch; it is printed this many rows
 * at a time, frame by frame while the picture develops, rather than all at once as it starts. */
const INK_ROWS_PER_FRAME = 64;
/** The entrance is worked out in idle time before the opening, waiting at most this long. */
const PREPARE_WAIT = 200;
/** The photograph is held on the canvas this long past the handover, so no frame shows neither. */
const HANDOVER_HOLD = 120;
/** The appearance order follows the photograph's light, softened by this factor. */
const LIGHT_SOFTENING = 10;

/**
 * Draws the entrance on `[data-portrait-develop]`, a canvas over the portrait's frame; its
 * `data-portrait-pixels` names the pixel picture.
 */
export function createPortraitDevelop(hero: HTMLElement) {
  const time = currentPortraitTiming();
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-portrait-develop]');
  const image = hero.querySelector<HTMLImageElement>('.portrait');
  const context = canvas?.getContext('2d');
  const picture = new Image();
  if (canvas?.dataset.portraitPixels) picture.src = canvas.dataset.portraitPixels;
  let frame = 0;
  /** The entrance, worked out ahead and waiting to start. */
  let prepared: (() => void) | undefined;
  // Playback and skipping both consume this one-shot entrance. Late idle work must not rebuild it.
  let consumed = false;

  const stop = () => {
    consumed = true;
    prepared = undefined;
    cancelAnimationFrame(frame);
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
  };

  /**
   * Works out the entrance: reads both images, orders the picture's cells, and lays out the
   * canvases it draws on. Returns the function that starts it, or nothing when an image cannot be
   * read yet.
   */
  const prepare = (): (() => void) | undefined => {
    const frameBox = canvas?.parentElement?.getBoundingClientRect();
    if (!canvas || !context || !frameBox || !image) return undefined;
    if (!image.complete || !image.naturalWidth || !picture.complete || !picture.naturalWidth)
      return undefined;

    // Everything below is in device pixels, the grid of the canvas itself.
    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(box.width * ratio);
    const height = Math.round(box.height * ratio);
    if (!width || !height) return undefined;
    const grid = {
      originX: Math.round((frameBox.left - box.left) * ratio),
      originY: Math.round((frameBox.top - box.top) * ratio),
      frameWidth: Math.round(frameBox.width * ratio),
      frameHeight: Math.round(frameBox.height * ratio),
      columns: picture.naturalWidth,
      rows: picture.naturalHeight,
    };
    let art: Uint8ClampedArray | undefined;
    let softLight: Uint8ClampedArray | undefined;
    try {
      art = pixelsOf(picture, grid.columns, grid.rows);
      softLight = pixelsOf(image, grid.columns, grid.rows, LIGHT_SOFTENING);
    } catch {
      return undefined;
    }
    if (!art || !softLight) return undefined;

    const { regionAt, shownAt } = revealTimes(softLight, grid.columns, grid.rows, time);
    const development = createDevelopment(art, shownAt, grid);
    // The tear ends with the lower third where HomeHero's styles shift the blue third.
    const inkShift = parseFloat(getComputedStyle(hero).getPropertyValue('--ink-shift')) || 0;
    const glitch = glitchFrames(grid.frameHeight, ratio, inkShift, time);

    // The picture as it has developed, drawn cell by cell as each switches on; for the glitch, the
    // photograph, and the photograph in the blue ink, masked to the regions that have come up so far.
    const developed = context.createImageData(width, height);
    const developedBuffer = { pixels: new Uint32Array(developed.data.buffer), width, height };
    const pictureLayer = canvasOf(width, height);
    const photo = canvasOf(grid.frameWidth, grid.frameHeight);
    const formedPhoto = canvasOf(grid.frameWidth, grid.frameHeight);
    const inkPhoto = canvasOf(grid.frameWidth, grid.frameHeight);
    const formedInk = canvasOf(grid.frameWidth, grid.frameHeight);
    const formedMask = canvasOf(grid.columns, grid.rows);
    const pictureContext = pictureLayer.getContext('2d');
    const photoContext = photo.getContext('2d');
    const formedPhotoContext = formedPhoto.getContext('2d');
    const inkPhotoContext = inkPhoto.getContext('2d');
    const formedInkContext = formedInk.getContext('2d');
    const maskContext = formedMask.getContext('2d');
    if (
      !pictureContext ||
      !photoContext ||
      !formedPhotoContext ||
      !inkPhotoContext ||
      !formedInkContext ||
      !maskContext
    )
      return undefined;
    photoContext.drawImage(image, 0, 0, grid.frameWidth, grid.frameHeight);
    let inked: ImageData;
    try {
      inked = photoContext.getImageData(0, 0, grid.frameWidth, grid.frameHeight);
    } catch {
      return undefined;
    }
    let inkedRows = 0;
    /** Prints up to `rows` more rows of the photograph in the blue ink; true once all are. */
    const printInk = (rows: number) => {
      if (inkedRows >= inked.height) return true;
      const to = Math.min(inked.height, inkedRows + rows);
      printInBlueInk(inked.data.subarray(inkedRows * inked.width * 4, to * inked.width * 4));
      inkedRows = to;
      if (to < inked.height) return undefined;
      inkPhotoContext.putImageData(inked, 0, 0);
      return true;
    };
    const maskPixels = maskContext.createImageData(grid.columns, grid.rows);
    const sources: GlitchSources = {
      ...grid,
      picture: pictureLayer,
      photo: formedPhoto,
      ink: formedInk,
    };
    /** Draws `full` onto `formed` only where the picture has come up. */
    const formedOnly = (formed: CanvasRenderingContext2D, full: HTMLCanvasElement) => {
      formed.globalCompositeOperation = 'copy';
      formed.drawImage(full, 0, 0);
      formed.globalCompositeOperation = 'destination-in';
      formed.imageSmoothingEnabled = false;
      formed.drawImage(formedMask, 0, 0, grid.frameWidth, grid.frameHeight);
    };

    return () => {
      canvas.width = width;
      canvas.height = height;
      const startedAt = performance.now();
      const draw = (now: number) => {
        const elapsed = now - startedAt;
        if (elapsed >= time.glitchEnd + HANDOVER_HOLD) {
          context.clearRect(0, 0, width, height);
          return;
        }
        development.step(elapsed, developedBuffer);
        if (elapsed < time.glitchStart) {
          printInk(INK_ROWS_PER_FRAME);
          context.putImageData(developed, 0, 0);
        } else {
          // The photograph is the picture's truth: it shows only where the picture has appeared.
          pictureContext.putImageData(developed, 0, 0);
          for (let cell = 0; cell < regionAt.length; cell++)
            maskPixels.data[cell * 4 + 3] = elapsed >= regionAt[cell] ? 255 : 0;
          maskContext.putImageData(maskPixels, 0, 0);
          formedOnly(formedPhotoContext, photo);
          const current = glitch.find((step) => elapsed < step.until) ?? glitch[glitch.length - 1];
          if (current.bands.some(({ source }) => source === 'ink') && printInk(Infinity))
            formedOnly(formedInkContext, inkPhoto);
          drawGlitchFrame(context, current, sources);
        }
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    };
  };

  /** Settles once both images have decoded, or failed to, and the entrance is worked out: in the
   * browser's idle time, before the opening starts, when nothing moves that a busy moment could
   * hold up. */
  const ready = Promise.all([picture.decode(), image?.decode()])
    .catch(() => {})
    .then(
      () =>
        new Promise<void>((resolve) =>
          whenIdle(() => {
            if (!consumed) prepared = prepare();
            resolve();
          }, PREPARE_WAIT),
        ),
    );

  /** Starts the entrance. Returns false, drawing nothing, when an image cannot be read yet. */
  const play = (): boolean => {
    if (consumed) return false;
    consumed = true;
    const start = prepared ?? prepare();
    prepared = undefined;
    start?.();
    return !!start;
  };

  return { ready, play, stop };
}
