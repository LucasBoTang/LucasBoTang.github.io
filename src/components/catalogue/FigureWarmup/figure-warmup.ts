import { enhance } from '../../../lib/lifecycle';
import { openingPending } from '../../../lib/opening-gate';
import { holdPageReady } from '../../../lib/page-ready';

// The GPU compiles a shader program the first time it draws each kind of thing a figure draws,
// and on a cold cache each takes about ten milliseconds, one after another: a figure's first frame
// can hold the whole tab for a third of a second, right under the pointer that asked for it. So
// while the page's opening still keeps it dark, every figure the page can show is drawn once,
// unseen, in a slot that is in view but nearly transparent, and so is every filter the page's own
// entrances will pass through as a figure appears. The programs are then cached for the real
// appearance, and the opening waits for this within its own bound (page-ready.ts), so the stall
// lands in the dark rather than on the reader. Browsers keep the programs on disk, so a returning
// visitor's warm-up finds them already there and takes a few frames.

/** A figure document and the size its embed will give it; the compact size below `compactAt`. */
export interface FigureSource {
  src: string;
  width: number;
  height: number;
  compactAt?: number;
  compact?: { width: number; height: number };
}

/** The filters an entrance passes through, in order, as an element marked `data-warm-filters`
 * declares them. */
export type FilterSequence = string[];

/** The slot's opacity: enough that the browser rasterizes the figures, too little to see. */
const OPACITY = '0.02';
/** Frames each figure is given once its fonts and images are ready, so its first draws happen;
 * a filter sequence is played over the same frames. */
const FRAMES = 8;
/** Warming gives up after this long, inside the opening's own bound (page-ready.ts). */
const TIMEOUT = 1400;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Settles once `frame`'s document has its fonts and images, or when it cannot be read. */
async function resourcesOf(frame: HTMLIFrameElement) {
  const inner = frame.contentDocument;
  if (!inner) return;
  const images = [...inner.images].map((image) => image.decode?.());
  await Promise.allSettled([inner.fonts?.ready, ...images]);
}

/** A figure document loading in the slot, settling once it has drawn its first frames. */
function figureFrame(source: FigureSource) {
  const frame = document.createElement('iframe');
  const compact = source.compact && source.compactAt && innerWidth < source.compactAt;
  const size = compact ? source.compact! : source;
  frame.width = String(size.width);
  frame.height = String(size.height);
  frame.title = '';
  frame.tabIndex = -1;
  frame.style.cssText = 'position:absolute;left:0;top:0;border:0';
  const drawn = new Promise<void>((resolve) => {
    frame.addEventListener(
      'load',
      async () => {
        await resourcesOf(frame);
        for (let i = 0; i < FRAMES; i++) await nextFrame();
        resolve();
      },
      { once: true },
    );
  });
  frame.src = source.src;
  return { frame, drawn };
}

/** A small lettered box in the slot, carried through `sequence` over the warm-up's frames. */
function filterBox(sequence: FilterSequence) {
  const box = document.createElement('span');
  box.setAttribute('data-warm-filter', sequence.join(' / '));
  box.textContent = 'Aa';
  box.style.cssText =
    'position:absolute;left:0;top:0;width:24px;height:24px;background:var(--blue);color:var(--paper)';
  box.animate?.(
    sequence.map((filter) => ({ filter })),
    { duration: FRAMES * 16, fill: 'both' },
  );
  return box;
}

/**
 * Draws each of `sources` once in a hidden slot, and plays each of `filters` there, settling once
 * all have drawn their first frames or `timeout` has passed. The slot is removed either way.
 */
export function warmFigures(
  sources: FigureSource[],
  filters: FilterSequence[] = [],
  timeout = TIMEOUT,
): Promise<void> {
  if (!sources.length && !filters.length) return Promise.resolve();
  const slot = document.createElement('div');
  slot.setAttribute('data-figure-warmup', '');
  slot.setAttribute('aria-hidden', 'true');
  slot.style.cssText = `position:fixed;left:0;top:0;width:1px;height:1px;opacity:${OPACITY};overflow:visible;pointer-events:none`;
  const figures = sources.map(figureFrame);
  slot.append(...figures.map(({ frame }) => frame), ...filters.map(filterBox));
  document.body.append(slot);
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(limit);
      slot.remove();
      resolve();
    };
    const limit = window.setTimeout(finish, timeout);
    const played = (async () => {
      for (let i = 0; i < FRAMES; i++) await nextFrame();
    })();
    void Promise.all([...figures.map(({ drawn }) => drawn), played]).then(finish);
  });
}

/** Every filter sequence the page's entrances declare, each once. */
function declaredFilters(): FilterSequence[] {
  const sequences = new Map<string, FilterSequence>();
  for (const element of document.querySelectorAll<HTMLElement>('[data-warm-filters]'))
    for (const sequence of JSON.parse(element.dataset.warmFilters ?? '[]') as FilterSequence[])
      sequences.set(sequence.join('|'), sequence);
  return [...sequences.values()];
}

enhance('[data-figure-warmup-sources]', (host) => {
  // Previews open on hover, so on a screen without hover they are not drawn ahead; nor is
  // anything drawn ahead for a visitor saving data, or when no opening keeps the page dark.
  const hoverOnly = host.hasAttribute('data-figure-warmup-hover');
  if (hoverOnly && !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData || !openingPending()) return;
  const sources = JSON.parse(host.dataset.figureWarmupSources ?? '[]') as FigureSource[];
  holdPageReady(warmFigures(sources, declaredFilters()));
});
