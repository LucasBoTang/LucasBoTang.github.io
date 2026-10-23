import { BEAM_FRAMES, ECHO_FRAMES, PICTURE_FRAMES, POWER_ON } from './wordmark-entrance.ts';

// Thin, separated tears displace the ink; some frames also split off a faint colour channel.
const FALLBACK_INK = { top: 0.25, bottom: 0.75 } as const;
const BANDS = [1, 2];
const BAND_HEIGHT = [0.05, 0.12];
const SHIFT = [2, 5];
const CLEAN_CHANCE = 0.2;
/** On some redraws a faint light copy splits off by a pixel or so. */
const SPLIT = [1, 1.5];
const SPLIT_CHANCE = 0.4;

const between = ([low, high]: number[]) => low + Math.random() * (high - low);
const sign = () => (Math.random() < 0.5 ? -1 : 1);
const textMeasure = document.createElement('canvas').getContext('2d');

/** Where the word's letters have ink, as shares of its line from the top: the line also holds
 * empty space above and below, which a tear must miss. */
function inkOf(glyphs: HTMLElement, face: HTMLElement) {
  const word = glyphs.getBoundingClientRect();
  const style = getComputedStyle(glyphs);
  if (!textMeasure || !word.height) return FALLBACK_INK;
  textMeasure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const metrics = textMeasure.measureText(face.textContent ?? '');
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;
  if (!Number.isFinite(ascent) || !Number.isFinite(descent)) return FALLBACK_INK;
  const baseline = (word.height - ascent - descent) / 2 + ascent;
  return {
    top: (baseline - metrics.actualBoundingBoxAscent) / word.height,
    bottom: (baseline + metrics.actualBoundingBoxDescent) / word.height,
  };
}

/** Owns letter measurements and drawing layers; the controller decides when each frame plays. */
export function createWordmarkRenderer(node: HTMLElement) {
  const glyphs = node.querySelector<HTMLElement>(':scope > .project-glyphs');
  const face = glyphs?.querySelector<HTMLElement>('.project-face');
  const echo = glyphs?.querySelector<HTMLElement>('.project-echo');
  if (!glyphs || !face || !echo) return;
  // A layer for each band a redraw can tear.
  const bands = Array.from({ length: BANDS[1] }, () => {
    const band = document.createElement('span');
    band.className = 'project-band';
    band.setAttribute('aria-hidden', 'true');
    band.textContent = face.textContent;
    glyphs.append(band);
    return band;
  });
  // The beam a power-on snaps on; it waits hidden at the middle of the letters.
  const beam = document.createElement('span');
  beam.className = 'project-beam';
  beam.setAttribute('aria-hidden', 'true');
  glyphs.append(beam);
  const entranceLayers = [
    [beam, BEAM_FRAMES],
    [face, PICTURE_FRAMES],
    [echo, ECHO_FRAMES],
  ] as const;
  // Measured when first needed, not as the page loads, and again whenever the word may have
  // changed size.
  let measured: ReturnType<typeof inkOf> | undefined;
  const ink = () => (measured ??= inkOf(glyphs, face));
  new ResizeObserver(() => (measured = undefined)).observe(glyphs);
  void document.fonts.ready.then(() => (measured = undefined));

  let disturbed = false;

  const settle = () => {
    node.removeAttribute('data-glitching');
    disturbed = false;
    face.style.maskImage = '';
    echo.removeAttribute('style');
    bands.forEach((band) => {
      band.removeAttribute('data-torn');
      band.removeAttribute('style');
    });
  };

  /** Draws one redraw of the tremor at `strength`, from 0 to 1. */
  const draw = (strength: number) => {
    const { top: inkTop, bottom: inkBottom } = ink();
    const span = inkBottom - inkTop;
    const percent = (share: number) => `${(share * 100).toFixed(1)}%`;
    // Thin bands at random through the ink, kept apart so each reads on its own.
    const torn: [number, number][] = [];
    const count = Math.random() < CLEAN_CHANCE ? 0 : Math.round(between(BANDS));
    for (let tries = 0; torn.length < count && tries < 12; tries++) {
      const height = between(BAND_HEIGHT) * span;
      const top = inkTop + Math.random() * (span - height);
      if (torn.some(([t, b]) => top < b + 0.02 && top + height > t - 0.02)) continue;
      torn.push([top, top + height]);
    }
    torn.sort((a, b) => a[0] - b[0]);
    const stops = torn.flatMap(([top, bottom]) => [
      `black ${percent(top)}`,
      `transparent ${percent(top)}`,
      `transparent ${percent(bottom)}`,
      `black ${percent(bottom)}`,
    ]);
    face.style.maskImage = stops.length ? `linear-gradient(to bottom, ${stops.join(', ')})` : '';
    bands.forEach((band, index) => {
      const tear = torn[index];
      band.toggleAttribute('data-torn', !!tear);
      if (!tear) return;
      const shift = between(SHIFT) * Math.max(0.3, strength) * sign();
      band.style.clipPath = `inset(${percent(tear[0])} -40px ${percent(1 - tear[1])} -40px)`;
      band.style.transform = `translateX(${shift.toFixed(1)}px)`;
    });
    if (torn.length && Math.random() < SPLIT_CHANCE) {
      echo.style.clipPath = 'none';
      echo.style.color = 'var(--signal-light)';
      echo.style.opacity = (0.12 + 0.2 * strength).toFixed(3);
      echo.style.transform = `translateX(${(between(SPLIT) * sign()).toFixed(1)}px)`;
    } else echo.removeAttribute('style');
    const now = torn.length > 0;
    if (now !== disturbed) node.toggleAttribute('data-glitching', (disturbed = now));
  };

  return {
    draw,
    settle,
    prepareEntrance(delay: number) {
      const { top: inkTop, bottom: inkBottom } = ink();
      const middle = `${(((inkTop + inkBottom) / 2) * 100).toFixed(1)}%`;
      beam.style.top = middle;
      face.style.transformOrigin = `center ${middle}`;
      return entranceLayers.map(([layer, frames]) =>
        layer.animate(frames, { duration: POWER_ON, delay, fill: 'backwards' }),
      );
    },
    cancelEntrance() {
      entranceLayers.forEach(([layer]) =>
        layer.getAnimations().forEach((animation) => animation.cancel()),
      );
    },
  };
}
