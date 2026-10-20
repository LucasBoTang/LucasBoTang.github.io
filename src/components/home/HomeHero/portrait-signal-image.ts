import { whenIdle } from '../../../lib/lifecycle';
import { printInBlueInk } from './blue-ink';
import { canvasOf } from './raster';

/** The lower third of the photograph is sampled at this size. */
export const SAMPLE = { width: 256, height: 128 };

const sampleCanvas = () => canvasOf(SAMPLE.width, SAMPLE.height);

/** Prepares the sampled photograph and its colour channels; failure leaves the static image visible. */
export function createPortraitSignalImage(image: HTMLImageElement) {
  const { width, height } = SAMPLE;
  const tinted = sampleCanvas();
  const tintedContext = tinted.getContext('2d');
  if (!tintedContext) return;
  const natural = sampleCanvas();
  const naturalContext = natural.getContext('2d');
  // Each colour channel alone, of the blue and of the natural photograph.
  const tintedChannels: HTMLCanvasElement[] = [];
  const naturalChannels: HTMLCanvasElement[] = [];
  const sampling = new Image();
  sampling.src = image.currentSrc || image.src;
  const ready = sampling
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
      return true;
    })
    .catch(() => {
      // The blue image drawn by HomeHero's SVG filter remains as the fallback.
      return false;
    });

  return { ready, tinted, natural, hasNatural: !!naturalContext, tintedChannels, naturalChannels };
}
