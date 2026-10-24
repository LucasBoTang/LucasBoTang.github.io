import { hasFigureDrawn } from '../../../lib/figure-ready.ts';

/** A figure document and the size its embed will give it; the compact size below `compactAt`. */
export interface FigureSource {
  src: string;
  width: number;
  height: number;
  compactAt?: number;
  compact?: { width: number; height: number };
}

/** Filter keyframes declared by an entrance. */
export type FilterSequence = string[];

// Zero opacity skips GPU compilation; this nonzero value is visually imperceptible.
const WARMUP_OPACITY = '0.001';
// Figure clocks sweep their cycles during these frames (figure-clock.ts).
const WARMUP_FRAMES = 24;
/** A figure's warm-up gives up after this long, its document fetch included. */
const WARMUP_TIMEOUT_MS = 4000;

/** Settles once `frame`'s document has its fonts and images, or when it cannot be read. */
async function waitForFrameResources(frame: HTMLIFrameElement) {
  const inner = frame.contentDocument;
  if (!inner) return;
  const images = [...inner.images].map((image) => image.decode?.());
  await Promise.allSettled([inner.fonts?.ready, ...images]);
}

/** A figure document loading in the slot, settling once it has drawn its first frames. */
function createFigureFrame(source: FigureSource) {
  const frame = document.createElement('iframe');
  const { compact, compactAt } = source;
  const size = compact && compactAt && innerWidth < compactAt ? compact : source;
  frame.width = String(size.width);
  frame.height = String(size.height);
  frame.title = '';
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'absolute', left: '0', top: '0', border: '0' });
  let resourcesReady = false;
  frame.addEventListener(
    'load',
    async () => {
      await waitForFrameResources(frame);
      resourcesReady = true;
    },
    { once: true },
  );
  frame.src = source.src;
  return { frame, isReady: () => resourcesReady && hasFigureDrawn(frame.contentDocument) };
}

/** A small lettered box in the slot, carried through `sequence` over the warm-up's frames. */
function createFilterBox(sequence: FilterSequence) {
  const box = document.createElement('span');
  box.setAttribute('data-warm-filter', sequence.join(' / '));
  box.textContent = 'Aa';
  Object.assign(box.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '24px',
    height: '24px',
    background: 'var(--blue)',
    color: 'var(--paper)',
  });
  box.animate?.(
    sequence.map((filter) => ({ filter })),
    { duration: WARMUP_FRAMES * 16, fill: 'both' },
  );
  return box;
}

/** Draw and remove the temporary slot; false means its timeout elapsed. */
export function warmFigures(
  sources: FigureSource[],
  filters: FilterSequence[] = [],
  timeoutMs = WARMUP_TIMEOUT_MS,
): Promise<boolean> {
  if (!sources.length && !filters.length) return Promise.resolve(true);
  const slot = document.createElement('div');
  slot.setAttribute('data-figure-warmup', '');
  slot.setAttribute('aria-hidden', 'true');
  Object.assign(slot.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '1px',
    height: '1px',
    opacity: WARMUP_OPACITY,
    overflow: 'visible',
    pointerEvents: 'none',
  });
  const figures = sources.map(createFigureFrame);
  slot.append(...figures.map(({ frame }) => frame), ...filters.map(createFilterBox));
  document.body.append(slot);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let frameId = 0;
    let drawnFrames = 0;
    const finish = (isComplete: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      cancelAnimationFrame(frameId);
      slot.remove();
      resolve(isComplete);
    };
    const timeoutId = window.setTimeout(() => finish(false), timeoutMs);
    const sweep = () => {
      if (figures.every(({ isReady }) => isReady())) drawnFrames++;
      else drawnFrames = 0;
      if (drawnFrames >= WARMUP_FRAMES) finish(true);
      else frameId = requestAnimationFrame(sweep);
    };
    frameId = requestAnimationFrame(sweep);
  });
}
