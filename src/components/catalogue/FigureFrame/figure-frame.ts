import type { ResearchFigure } from '../../../data/schema.ts';
import { enhance } from '../../../lib/lifecycle.ts';

// Narrow desktop columns and wider phones keep one approved composition. Only a phone column
// below the artwork's own breakpoint uses its compact layout; that layout can also declare a
// minimum canvas to preserve its geometry. Bleed and height always shrink with the same scale.
enhance<HTMLElement>('[data-scalable-figure]', (frame) => {
  // The build validates the record; the browser receives no captions or credit text.
  const fitting = JSON.parse(frame.dataset.figureFit!) as ResearchFigure['fitting'];
  // Read the initial inline canvas once; these declarations already provide the no-JS layout.
  // Reading inline values does not ask the browser to recompute style or layout.
  const dimension = (name: string) =>
    parseFloat(frame.style.getPropertyValue(`--figure-canvas-${name}`));
  const original = {
    width: dimension('width'),
    height: dimension('height'),
    bleed: dimension('bleed'),
  };
  const desktop = matchMedia('(min-width: 721px)');
  let availableWidth = frame.clientWidth;

  function fit() {
    const compact = !desktop.matches && availableWidth <= fitting.compactAt;
    const canvas = compact && fitting.compactCanvas ? fitting.compactCanvas : original;
    const contentWidth = canvas.width - 2 * canvas.bleed;
    const scaled =
      (!compact || fitting.compactCanvas !== null) &&
      availableWidth > 0 &&
      availableWidth < contentWidth;
    frame.style.setProperty('--figure-canvas-width', `${canvas.width}px`);
    frame.style.setProperty('--figure-canvas-height', `${canvas.height}px`);
    frame.style.setProperty('--figure-canvas-bleed', `${canvas.bleed}px`);
    frame.toggleAttribute('data-scaled', scaled);
    frame.style.setProperty('--figure-scale', String(scaled ? availableWidth / contentWidth : 1));
  }

  new ResizeObserver(([entry]) => {
    const width = entry.contentRect.width;
    if (width === availableWidth) return;
    availableWidth = width;
    fit();
  }).observe(frame);
  desktop.addEventListener('change', fit);
  fit();
});
