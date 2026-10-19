// Draws the portrait as pixel art for the home opening: `npm run portrait` writes
// src/assets/portrait-pixels.png, one image pixel per art pixel, its grey level the tone
// (0 empty, 85 dim, 170 mid, 255 light). The opening develops the portrait from these pixels.
//
// The photograph first becomes a line drawing: the figure is separated from the wall by colour,
// facial features and hair strands come from an XDoG filter, and clothing folds from a broader
// one. The drawing then becomes pixels: skin in two light tones with lines cut into it, hair in
// the dim tone, the sweater only outlined where it meets the wall, the table one flat tone.
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = fileURLToPath(new URL('../src/assets/bo-tang.jpg', import.meta.url));
const output = fileURLToPath(new URL('../src/assets/portrait-pixels.png', import.meta.url));

/** The drawing is made at this size, then reduced to the pixel grid. */
const W = 512;
const H = 768;
/** The pixel grid: 1.5 CSS pixels per art pixel in the 256-pixel portrait frame. */
const GRID_WIDTH = 170;
const GRID_HEIGHT = 255;

// ------------------------------------------------------------------------------------- helpers
function gauss(values, sigma) {
  const radius = Math.ceil(sigma * 3);
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, i) =>
    Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)),
  );
  const pass = (input, horizontal) => {
    const result = new Float32Array(input.length);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let sum = 0;
        let weight = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = horizontal ? Math.min(W - 1, Math.max(0, x + k)) : x;
          const yy = horizontal ? y : Math.min(H - 1, Math.max(0, y + k));
          sum += input[yy * W + xx] * kernel[k + radius];
          weight += kernel[k + radius];
        }
        result[y * W + x] = sum / weight;
      }
    return result;
  };
  return pass(pass(values, true), false);
}

/** Keeps the connected regions of `mask` that have at least `min` pixels. */
function keepLarge(mask, min) {
  const seen = new Uint8Array(W * H);
  const keep = new Uint8Array(W * H);
  for (let start = 0; start < W * H; start++) {
    if (!mask[start] || seen[start]) continue;
    const region = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      region.push(i);
      const x = i % W;
      for (const n of [i - W, i + W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) {
        if (n >= 0 && n < W * H && mask[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (region.length >= min) for (const i of region) keep[i] = 1;
  }
  return keep;
}

/** Fills enclosed gaps in `mask` smaller than `max` pixels. */
function fillHoles(mask, max) {
  const open = keepLarge(
    mask.map((v) => (v ? 0 : 1)),
    max,
  );
  return mask.map((v, i) => (v || !open[i] ? 1 : 0));
}

/** XDoG: where a fine blur falls below a broader one, the image has a dark stroke. */
function strokes(grey, sigma, tau, threshold, where) {
  const fine = gauss(grey, sigma);
  const broad = gauss(grey, sigma * 1.6);
  return grey.map((_, i) => (where(i) && fine[i] - tau * broad[i] < threshold ? 1 : 0));
}

const luminance = (data, i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];

// ---------------------------------------------------------------------------- the line drawing
const colour = await sharp(source).resize(W, H, { kernel: 'lanczos3' }).raw().toBuffer();
const grey = Float32Array.from({ length: W * H }, (_, i) => luminance(colour, i * 3) / 255);
const blurred = await sharp(source).resize(W, H).blur(2).raw().toBuffer();
const light = Float32Array.from({ length: W * H }, (_, i) => luminance(blurred, i * 3));

// The figure is skin, plus hair and clothes, which are colour-neutral or deeper than the warm
// wall. The table is warm and low in the frame.
const rawFigure = new Float32Array(W * H);
const rawTable = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const [r, g, b] = [blurred[i * 3], blurred[i * 3 + 1], blurred[i * 3 + 2]];
  const lum = light[i];
  const table = i / W > H * 0.62 && r - b > 0.6 * lum + 8 && lum > 18 && lum < 150;
  rawTable[i] = table ? 1 : 0;
  rawFigure[i] = !table && (lum >= 60 || b / (g + 3) > 0.65 || lum < 13) ? 1 : 0;
}
const figure = fillHoles(
  keepLarge(
    gauss(rawFigure, 9).map((v) => (v > 0.5 ? 1 : 0)),
    4000,
  ),
  6000,
);
const table = keepLarge(
  gauss(rawTable, 4).map((v) => (v > 0.5 ? 1 : 0)),
  4000,
);
const inside = gauss(figure, 2);

// Features and hair strands; then long folds in the dark fabric below the face.
const CLOTHES_TOP = 0.47;
const ink = keepLarge(
  strokes(grey, 1.2, 0.98, -0.006, (i) => inside[i] > 0.6),
  18,
);
const fold = keepLarge(
  strokes(
    grey,
    2.4,
    0.99,
    -0.0025,
    (i) => i / W > H * CLOTHES_TOP && inside[i] > 0.9 && grey[i] < 0.2,
  ),
  60,
);

// ------------------------------------------------------------------------------ to the grid
const sx = W / GRID_WIDTH;
const sy = H / GRID_HEIGHT;
/** The average of `value` over each grid cell. */
const perCell = (value) => {
  const result = new Float32Array(GRID_WIDTH * GRID_HEIGHT);
  for (let gy = 0; gy < GRID_HEIGHT; gy++)
    for (let gx = 0; gx < GRID_WIDTH; gx++) {
      let sum = 0;
      let count = 0;
      for (let y = Math.floor(gy * sy); y < Math.floor((gy + 1) * sy); y++)
        for (let x = Math.floor(gx * sx); x < Math.floor((gx + 1) * sx); x++) {
          sum += value(y * W + x);
          count++;
        }
      result[gy * GRID_WIDTH + gx] = sum / count;
    }
  return result;
};
const tone = gauss(grey, 3);
const cellFigure = perCell((i) => figure[i]);
const cellTable = perCell((i) => table[i]);
const cellSkin = perCell((i) => (figure[i] && light[i] >= 60 ? 1 : 0));
const cellTone = perCell((i) => tone[i]);
const cellLight = perCell((i) => light[i]);
const cellInk = perCell((i) => ink[i]);
const cellFold = perCell((i) => fold[i]);

/** Zhang-Suen thinning, so fold lines are one pixel wide. */
function thin(mask) {
  const m = Uint8Array.from(mask);
  const G = GRID_WIDTH;
  for (let changed = true; changed;) {
    changed = false;
    for (const step of [0, 1]) {
      const remove = [];
      for (let y = 1; y < GRID_HEIGHT - 1; y++)
        for (let x = 1; x < G - 1; x++) {
          const i = y * G + x;
          if (!m[i]) continue;
          const p = [
            m[i - G],
            m[i - G + 1],
            m[i + 1],
            m[i + G + 1],
            m[i + G],
            m[i + G - 1],
            m[i - 1],
            m[i - G - 1],
          ];
          const neighbours = p.reduce((sum, v) => sum + v, 0);
          if (neighbours < 2 || neighbours > 6) continue;
          let transitions = 0;
          for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) transitions++;
          if (transitions !== 1) continue;
          const blocked =
            step === 0
              ? p[0] * p[2] * p[4] || p[2] * p[4] * p[6]
              : p[0] * p[2] * p[6] || p[0] * p[4] * p[6];
          if (!blocked) remove.push(i);
        }
      for (const i of remove) m[i] = 0;
      if (remove.length) changed = true;
    }
  }
  return m;
}

const isFigure = (c) => cellFigure[c] > 0.5;
const isSkin = (c) => cellSkin[c] > 0.5;
const isTable = (c) => cellTable[c] > 0.5 && !isSkin(c);
const clothesRow = GRID_HEIGHT * CLOTHES_TOP;

// The head is the face's extent widened for the hair; dark parts outside it are clothes.
let left = GRID_WIDTH;
let right = 0;
let top = GRID_HEIGHT;
let bottom = 0;
for (let gy = 0; gy < clothesRow; gy++)
  for (let gx = 0; gx < GRID_WIDTH; gx++)
    if (isSkin(gy * GRID_WIDTH + gx)) {
      left = Math.min(left, gx);
      right = Math.max(right, gx);
      top = Math.min(top, gy);
      bottom = Math.max(bottom, gy);
    }
const faceWidth = right - left;
const inHead = (gx, gy) =>
  gy < clothesRow && gx > left - faceWidth * 0.35 && gx < right + faceWidth * 0.3;

const art = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
for (let gy = 0; gy < GRID_HEIGHT; gy++)
  for (let gx = 0; gx < GRID_WIDTH; gx++) {
    const c = gy * GRID_WIDTH + gx;
    if (isSkin(c)) art[c] = cellTone[c] > 0.5 ? 3 : 2;
    else if (isTable(c)) art[c] = 1;
    // Hair has some light, and fills the crown; the near-black sweater stays unfilled.
    else if (
      isFigure(c) &&
      inHead(gx, gy) &&
      (cellLight[c] >= 15 || gy < top + (bottom - top) * 0.5)
    )
      art[c] = 1;
  }
// Only the sweater's left side is outlined, where it meets the wall, and not along the table.
const TABLE_MARGIN = 3;
const nearTable = (gx, gy) => {
  for (let dy = -TABLE_MARGIN; dy <= TABLE_MARGIN; dy++)
    for (let dx = -TABLE_MARGIN; dx <= TABLE_MARGIN; dx++) {
      const x = gx + dx;
      const y = gy + dy;
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT && isTable(y * GRID_WIDTH + x))
        return true;
    }
  return false;
};
for (let gy = 1; gy < GRID_HEIGHT - 1; gy++)
  for (let gx = 1; gx < GRID_WIDTH - 1; gx++) {
    const c = gy * GRID_WIDTH + gx;
    if (!isFigure(c) || isSkin(c) || isTable(c) || art[c]) continue;
    if (gx >= left || nearTable(gx, gy)) continue;
    const open = [c - 1, c + 1, c - GRID_WIDTH, c + GRID_WIDTH].some(
      (n) => !isFigure(n) && !isTable(n),
    );
    if (open) art[c] = 2;
  }
// Clothes lines: the outline, folds and drawn edges on the sweater share the outline's tone and
// are one pixel wide. Elsewhere, drawn lines are cut into the lit forms and the hair.
const foldLine = thin(cellFold.map((v) => (v >= 0.22 ? 1 : 0)));
// Lines hugging the face and hands would outline them; only the clothes are drawn in line.
const SKIN_MARGIN = 3;
const nearSkin = (c) => {
  const x = c % GRID_WIDTH;
  const y = Math.floor(c / GRID_WIDTH);
  for (let dy = -SKIN_MARGIN; dy <= SKIN_MARGIN; dy++)
    for (let dx = -SKIN_MARGIN; dx <= SKIN_MARGIN; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT && isSkin(ny * GRID_WIDTH + nx))
        return true;
    }
  return false;
};
const clothesLine = new Uint8Array(art.length);
for (let c = 0; c < art.length; c++) {
  const inked = cellInk[c] >= 0.3;
  if (art[c] === 2 && !isSkin(c)) clothesLine[c] = 1;
  else if (art[c]) {
    if (inked) art[c] = 0;
  } else if (
    isFigure(c) &&
    (inked || foldLine[c]) &&
    !nearTable(c % GRID_WIDTH, Math.floor(c / GRID_WIDTH))
  )
    clothesLine[c] = 1;
}
const drawn = thin(clothesLine).map((on, c) => (on && !nearSkin(c) ? 1 : 0));
for (let c = 0; c < art.length; c++) if (clothesLine[c] && art[c] === 2 && !isSkin(c)) art[c] = 0;
// Short, isolated strokes read as specks rather than drawing; only longer lines stay.
const MIN_LINE = 14;
const seen = new Uint8Array(art.length);
for (let start = 0; start < art.length; start++) {
  if (!drawn[start] || seen[start]) continue;
  const line = [];
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const c = stack.pop();
    line.push(c);
    const x = c % GRID_WIDTH;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const n = c + dy * GRID_WIDTH + dx;
        if (x + dx < 0 || x + dx >= GRID_WIDTH || n < 0 || n >= art.length) continue;
        if (drawn[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
  }
  if (line.length >= MIN_LINE) for (const c of line) art[c] = 2;
}

await sharp(Buffer.from(art.map((level) => level * 85)), {
  raw: { width: GRID_WIDTH, height: GRID_HEIGHT, channels: 1 },
})
  .png({ compressionLevel: 9 })
  .toFile(output);
console.log(`Wrote ${GRID_WIDTH}x${GRID_HEIGHT} portrait pixels.`);
