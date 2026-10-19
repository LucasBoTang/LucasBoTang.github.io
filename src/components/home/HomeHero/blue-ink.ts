import { luminance } from './raster';

// The blue ink of the portrait's lower third: the photograph's luminance mapped, channel by
// channel, from `dark` at black to `light` at white. HomeHero's SVG filter, the portrait signal's
// canvas and the portrait's entrance glitch all print with it.

export const blueInk = {
  dark: [0.025, 0.045, 0.08],
  light: [0.6, 0.72, 0.89],
};

/** Prints the RGBA `pixels` in the blue ink, in place. */
export function printInBlueInk(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const light = luminance(pixels, i);
    for (let channel = 0; channel < 3; channel++) {
      const dark = blueInk.dark[channel];
      pixels[i + channel] = (dark + light * (blueInk.light[channel] - dark)) * 255;
    }
  }
}
