import { enhance } from '../../../lib/lifecycle';
import { openingPending, waitForOpeningVisible } from '../../../lib/opening-gate';

// The GPU compiles a shader program the first time it draws each kind of thing a figure draws,
// and on a cold cache each takes about ten milliseconds, one after another: a figure's first frame
// can hold the whole tab for a third of a second, right under the pointer that asked for it. So
// every figure the page can show is drawn once ahead, unseen, in a slot that is in view but nearly
// transparent, and so is every filter the page's own entrances pass through as a figure appears.
//
// None of this may delay the opening or compete with it. The figure documents are fetched only
// once the opening is visible, at the lowest priority, and drawn one at a time only once the
// opening has finished moving, the page is idle and the reader is not scrolling: a figure's
// warm-up shares the page's main thread and GPU, so it waits for a moment when nothing is in
// motion. A figure the page has already shown is skipped. Browsers keep the programs on disk, so
// the visitor's storage remembers each figure drawn or shown, and a later visit draws nothing ahead
// until that figure's source changes (figure-version.ts); the filters' few programs are cached
// alongside the first figure's.

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
/** Frames each figure is given once its fonts and images are ready. Its clock sweeps ahead over
 * them (figure-clock.ts), through about fourteen seconds of its cycles; a filter sequence is
 * played over the same frames. */
const FRAMES = 24;
/** Where the figures already drawn through are remembered, by their documents' paths and the
 * version of the figures' source they were drawn from. */
const STORAGE_KEY = 'figure-warmup';
/** A figure's warm-up gives up after this long, its document fetch included. */
const TIMEOUT = 4000;
/** How long the reader must have stopped scrolling before a figure is drawn ahead. */
const SCROLL_QUIET = 600;
/** How often the page is checked for a quiet moment. */
const POLL = 250;
/** A passage left half typed, out of view, does not hold the warm-up longer than this. */
const PATIENCE = 8000;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

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
 * all have drawn their frames, true, or when `timeout` has passed, false. The slot is removed
 * either way.
 */
export function warmFigures(
  sources: FigureSource[],
  filters: FilterSequence[] = [],
  timeout = TIMEOUT,
): Promise<boolean> {
  if (!sources.length && !filters.length) return Promise.resolve(true);
  const slot = document.createElement('div');
  slot.setAttribute('data-figure-warmup', '');
  slot.setAttribute('aria-hidden', 'true');
  slot.style.cssText = `position:fixed;left:0;top:0;width:1px;height:1px;opacity:${OPACITY};overflow:visible;pointer-events:none`;
  const figures = sources.map(figureFrame);
  slot.append(...figures.map(({ frame }) => frame), ...filters.map(filterBox));
  document.body.append(slot);
  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (complete: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(limit);
      slot.remove();
      resolve(complete);
    };
    const limit = window.setTimeout(() => finish(false), timeout);
    const played = (async () => {
      for (let i = 0; i < FRAMES; i++) await nextFrame();
    })();
    void Promise.all([...figures.map(({ drawn }) => drawn), played]).then(() => finish(true));
  });
}

/** Whether the page has already shown `src` in an embed of its own. */
const shown = (src: string) =>
  [...document.querySelectorAll('iframe')].some(
    (frame) => frame.getAttribute('src') === src && !frame.closest('[data-figure-warmup]'),
  );

/** Whether the page's opening has finished moving: its gate is lifted, no passage is still
 * typing, the greeting has let go of the page, and no animation with an end is running. */
function openingSettled() {
  if (openingPending() || document.documentElement.hasAttribute('data-greeting-locked'))
    return false;
  if (document.querySelector('[data-typing-started]:not([data-typing-complete])')) return false;
  return !document
    .getAnimations()
    .some(
      (animation) =>
        animation.playState === 'running' &&
        Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)),
    );
}

let lastScroll = -Infinity;
for (const type of ['scroll', 'wheel', 'touchmove'])
  addEventListener(type, () => (lastScroll = performance.now()), { capture: true, passive: true });

/** Settles at a moment when nothing is in motion: the opening has settled, or `since` is long
 * past, the reader has stopped scrolling, and the browser is idle. */
async function quietMoment(since: number) {
  for (;;) {
    const now = performance.now();
    if ((openingSettled() || now - since > PATIENCE) && now - lastScroll > SCROLL_QUIET) break;
    await delay(POLL);
  }
  // Safari has no idle callback; a task after the poll is the nearest it offers.
  await new Promise<void>((resolve) =>
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback(() => resolve(), { timeout: 1000 })
      : setTimeout(resolve),
  );
}

/** Fetches `sources` ahead at the lowest priority, so that drawing them waits on no network. */
function prefetch(sources: FigureSource[]) {
  for (const { src } of sources) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = src;
    document.head.append(link);
  }
}

/**
 * Draws `sources` ahead one at a time, each at a quiet moment, skipping those already remembered
 * under `version` or already shown; `filters` play alongside the first figure drawn.
 */
export async function warmInTurn(
  sources: FigureSource[],
  version: string,
  filters: FilterSequence[] = [],
  quiet: (since: number) => Promise<void> = quietMoment,
) {
  const key = (source: FigureSource) => `${source.src}#${version}`;
  const pending = sources.filter((source) => !remembered().has(key(source)));
  if (!pending.length) return;
  await waitForOpeningVisible();
  const since = performance.now();
  prefetch(pending);
  for (const source of pending) {
    await quiet(since);
    // A figure the page has shown compiles its own programs; it is remembered all the same.
    if (shown(source.src)) {
      remember(key(source), version);
      continue;
    }
    const complete = await warmFigures([source], filters);
    filters = [];
    if (complete) remember(key(source), version);
  }
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
  // anything drawn ahead for a visitor saving data.
  const hoverOnly = host.hasAttribute('data-figure-warmup-hover');
  if (hoverOnly && !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  const sources = JSON.parse(host.dataset.figureWarmupSources ?? '[]') as FigureSource[];
  void warmInTurn(sources, host.dataset.figureWarmupVersion ?? '', declaredFilters());
});

/** The figures this browser has already drawn through; none when storage is off. */
function remembered(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/** Adds `key` to the record, dropping figures remembered under another version. */
function remember(key: string, version: string) {
  const keys = [...remembered(), key].filter((entry) => entry.endsWith(`#${version}`));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(keys)]));
  } catch {}
}
