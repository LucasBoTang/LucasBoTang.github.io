// Small canvas helpers for the hero's pixel work.

export function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** An image's RGBA pixels at the given size; `blur` first reduces it by that factor, for soft light. */
export function pixelsOf(
  image: CanvasImageSource,
  width: number,
  height: number,
  blur = 1,
): Uint8ClampedArray | undefined {
  const context = canvasOf(width, height).getContext('2d', { willReadFrequently: true });
  if (!context) return undefined;
  if (blur > 1) {
    const small = canvasOf(Math.max(1, width / blur), Math.max(1, height / blur));
    small.getContext('2d')?.drawImage(image, 0, 0, small.width, small.height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(small, 0, 0, width, height);
  } else {
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, width, height);
  }
  return context.getImageData(0, 0, width, height).data;
}

/** Relative luminance in [0, 1] of the RGBA pixel starting at `i`. */
export const luminance = (data: Uint8ClampedArray, i: number) =>
  (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;

/** A pixel buffer of packed little-endian RGBA, as `Uint32Array` views of `ImageData` give. */
export interface PixelBuffer {
  pixels: Uint32Array;
  width: number;
  height: number;
}

/** Fills a rectangle of `buffer` with `rgb` (packed 0xBBGGRR) at `alpha`, clipped to its edges. */
export function plot(
  buffer: PixelBuffer,
  x: number,
  y: number,
  across: number,
  down: number,
  rgb: number,
  alpha: number,
) {
  const pixel = (rgb | (Math.round(alpha * 255) << 24)) >>> 0;
  for (let row = Math.max(0, y); row < Math.min(buffer.height, y + down); row++) {
    const offset = row * buffer.width;
    for (let column = Math.max(0, x); column < Math.min(buffer.width, x + across); column++)
      buffer.pixels[offset + column] = pixel;
  }
}
