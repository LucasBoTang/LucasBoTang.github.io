import { hexChannels, theme } from '../../../data/theme';
import { openingTiming as time } from '../opening/opening';
import { luminance, plot, type PixelBuffer } from './raster';

// The pixel picture develops in place, like a print: nothing moves and nothing flickers. Each
// region comes up at its own moment, the face and hands first, spreading along feathered edges
// into the dark; within it, cells switch on in the order of an 8 × 8 Bayer matrix, so the picture
// fills in as an ordered screen of dots. The screen stops at half its cells, light and open, a
// picture made of air as much as of dots.

/** The picture's tones (its grey levels / 85): dim, mid and light blue, with their opacity. */
const TONES: [string, number][] = [
  [theme.blue, 0.55],
  [theme.blue, 1],
  [theme['signal-light'], 1],
];
/** Order weights: light, and a broad organic spread. Edges feather through the screen itself, so
 * no cell is jittered on its own, which would break the screen's order. */
const LIGHT_ORDER = 0.68;
const SPREAD_ORDER = 0.32;
/** Only cells whose threshold is below this ever switch on. */
const SCREEN_DENSITY = 0.5;

const packed = (hex: string) => {
  const [r, g, b] = hexChannels(hex);
  return ((b << 16) | (g << 8) | r) >>> 0;
};
/** The 8 × 8 Bayer threshold of a cell, in [0, 1): neighbouring thresholds lie far apart, so the
 * cells that pass a rising threshold spread evenly as an ordered screen. */
const bayer = (column: number, row: number) => {
  let value = 0;
  for (let bit = 0; bit < 3; bit++)
    value = (value << 2) | ((((column ^ row) >> bit) & 1) << 1) | ((row >> bit) & 1);
  return value / 64;
};

/** Smooth value noise in [0, 1], a few octaves deep, freshly seeded. */
function organicNoise() {
  const seed = Math.random() * 1000;
  const hash = (x: number, y: number) => {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
    return value - Math.floor(value);
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const layer = (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smooth(x - ix);
    const fy = smooth(y - iy);
    const top = hash(ix, iy) + (hash(ix + 1, iy) - hash(ix, iy)) * fx;
    const bottom = hash(ix, iy + 1) + (hash(ix + 1, iy + 1) - hash(ix, iy + 1)) * fx;
    return top + (bottom - top) * fy;
  };
  return (x: number, y: number) =>
    layer(x, y) * 0.55 + layer(x * 2.1, y * 2.1) * 0.3 + layer(x * 4.3, y * 4.3) * 0.15;
}

/**
 * When each cell's region comes up (`regionAt`), and when the cell itself switches on (`shownAt`,
 * `Infinity` for a cell the screen leaves open). Regions come up light first, spreading along
 * uneven, feathered edges into the dark, evenly through the forming time; within a region, the
 * Bayer threshold spreads each cell's moment around it.
 */
export function revealTimes(softLight: Uint8ClampedArray, columns: number, rows: number) {
  const count = columns * rows;
  const noise = organicNoise();
  const order = new Float32Array(count);
  for (let cell = 0; cell < count; cell++) {
    const x = (cell % columns) / columns;
    const y = Math.floor(cell / columns) / rows;
    order[cell] =
      LIGHT_ORDER * (1 - Math.sqrt(luminance(softLight, cell * 4))) +
      SPREAD_ORDER * noise(x * 5, y * 7.5);
  }
  const ranked = Array.from({ length: count }, (_, cell) => cell).sort(
    (a, b) => order[a] - order[b],
  );
  const regionAt = new Float32Array(count);
  const shownAt = new Float32Array(count);
  const span = time.formEnd - time.formStart;
  ranked.forEach((cell, rank) => {
    const threshold = bayer(cell % columns, Math.floor(cell / columns));
    regionAt[cell] = time.formStart + (rank / count) * span;
    shownAt[cell] =
      threshold < SCREEN_DENSITY
        ? regionAt[cell] + (threshold / SCREEN_DENSITY - 0.5) * time.formSpread
        : Infinity;
  });
  return { regionAt, shownAt };
}

/** Where the picture sits on the canvas, in device pixels, and its grid. */
interface PictureGrid {
  originX: number;
  originY: number;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
}

/**
 * The development of the pixel picture `art` (RGBA, grey level per cell), each cell switching on
 * at its `shownAt`. Each cell fills its own block of whole device pixels, so the picture reads as
 * solid pixel art without seams at any pixel density.
 */
export function createDevelopment(
  art: Uint8ClampedArray,
  shownAt: Float32Array,
  grid: PictureGrid,
) {
  const { originX, originY, frameWidth, frameHeight, columns, rows } = grid;
  const pitchX = frameWidth / columns;
  const pitchY = frameHeight / rows;
  // The picture's cells in the order they switch on: each is drawn once, when its moment comes.
  const cells: number[] = [];
  for (let cell = 0; cell < columns * rows; cell++) if (art[cell * 4] >= 43) cells.push(cell);
  cells.sort((a, b) => shownAt[a] - shownAt[b]);
  let shown = 0;

  /** Draws onto `buffer` every cell that has switched on by `elapsed` and was not drawn before. */
  const step = (elapsed: number, buffer: PixelBuffer) => {
    for (; shown < cells.length && shownAt[cells[shown]] <= elapsed; shown++) {
      const cell = cells[shown];
      const [hex, alpha] = TONES[Math.round(art[cell * 4] / 85) - 1];
      const column = cell % columns;
      const row = Math.floor(cell / columns);
      const left = originX + Math.round(column * pitchX);
      const top = originY + Math.round(row * pitchY);
      const across = Math.max(1, originX + Math.round((column + 1) * pitchX) - left);
      const down = Math.max(1, originY + Math.round((row + 1) * pitchY) - top);
      plot(buffer, left, top, across, down, packed(hex), alpha);
    }
  };

  return { step };
}
