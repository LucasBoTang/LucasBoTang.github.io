import type { Surface } from './sign-surface';

// A narrow band of pixels sweeps across the fields from left to right, again and again, covering
// part of the letters it passes over. The band leans forward like italic type.

const band = {
  /** Its width in cells, and how many cells further on each row runs than the one below it. */
  width: 3,
  slant: 0.5,
  /** It crosses the lettering over this long, at an even pace, then sets off again after
   * `rest`, in milliseconds. */
  duration: 1200,
  rest: 300,
};

/** The band over `lettering` on `surface`. */
export function createBand(lettering: SVGGraphicsElement, surface: Surface) {
  const { pitch, full, span } = surface;
  const show = surface.clip(lettering, 'band');
  const box = lettering.getBBox();
  const top = Math.floor(box.y / pitch);
  const bottom = Math.ceil((box.y + box.height) / pitch) - 1;
  const first = Math.floor(box.x / pitch);
  const last = Math.ceil((box.x + box.width) / pitch);
  // The band's foot runs from left of the lettering, with every row above it, to right of it.
  const lean = band.slant * (bottom - top);

  return {
    duration: band.duration,
    /**
     * Places the band `t` milliseconds after its first sweep sets off. Sweeps repeat until `until`;
     * one that could not finish by then does not start.
     */
    place(t: number, until: number) {
      const period = band.duration + band.rest;
      const start = Math.floor(t / period) * period;
      const progress = (t - start) / band.duration;
      let cells = '';
      if (t > 0 && start + band.duration <= until && progress > 0 && progress < 1) {
        const foot = first - lean + progress * (last + band.width - first + lean);
        for (let row = top; row <= bottom; row++) {
          const right = Math.round(foot + band.slant * (bottom - row));
          const from = Math.max(first, right - band.width);
          const to = Math.min(last, right);
          if (to > from) cells += span(row, from, to);
        }
      }
      show(full + cells);
    },
    /** Clears the band. */
    still() {
      show(full);
    },
  };
}
