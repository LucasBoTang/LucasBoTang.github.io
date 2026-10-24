import { enhance } from '../../../lib/lifecycle';
import { openingPending, waitForOpeningVisible } from '../../../lib/opening-gate';

import { createWarmupMemory } from './warmup-memory';
import { warmFigures, type FigureSource, type FilterSequence } from './warmup-renderer';

// Visible content has priority; warm hidden figures only after the opening settles.
const SCROLL_QUIET_MS = 600;
const POLL_INTERVAL_MS = 250;
const MAX_OPENING_WAIT_MS = 8000;
const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Ignore warm-up slots when checking visible embeds. */
const isFigureShown = (src: string) =>
  [...document.querySelectorAll('iframe')].some(
    (frame) => frame.getAttribute('src') === src && !frame.closest('[data-figure-warmup]'),
  );

/** No unfinished typing, greeting lock or finite animation remains. */
function isOpeningSettled() {
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

let lastScrollAt = -Infinity;
for (const type of ['scroll', 'wheel', 'touchmove'])
  addEventListener(type, () => (lastScrollAt = performance.now()), {
    capture: true,
    passive: true,
  });

/** Wait for settled motion, a scroll pause and browser idle; cap only the motion wait. */
async function waitForQuietMoment(startedAt: number) {
  for (;;) {
    const now = performance.now();
    if (
      (isOpeningSettled() || now - startedAt > MAX_OPENING_WAIT_MS) &&
      now - lastScrollAt > SCROLL_QUIET_MS
    )
      break;
    await delay(POLL_INTERVAL_MS);
  }
  // Safari has no idle callback; a task after the poll is the nearest it offers.
  await new Promise<void>((resolve) =>
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback(() => resolve(), { timeout: 1000 })
      : setTimeout(resolve),
  );
}

/** Fetches `sources` ahead at the lowest priority, so that drawing them waits on no network. */
function prefetchFigures(sources: FigureSource[]) {
  for (const { src } of sources) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = src;
    document.head.append(link);
  }
}

/** Warm unseen figures serially; filters accompany the first one. */
export async function warmInTurn(
  sources: FigureSource[],
  version: string,
  filters: FilterSequence[] = [],
  quiet: (startedAt: number) => Promise<void> = waitForQuietMoment,
) {
  const memory = createWarmupMemory(version);
  const pendingFigures = sources.filter((source) => !memory.has(source.src));
  if (!pendingFigures.length) return;
  await waitForOpeningVisible();
  const startedAt = performance.now();
  prefetchFigures(pendingFigures);
  for (const source of pendingFigures) {
    await quiet(startedAt);
    // Visible embeds compile their own programs; remember them without drawing again.
    if (isFigureShown(source.src)) {
      memory.remember(source.src);
      continue;
    }
    const isComplete = await warmFigures([source], filters);
    filters = [];
    if (isComplete) memory.remember(source.src);
  }
}

/** Every filter sequence the page's entrances declare, each once. */
function readDeclaredFilters(): FilterSequence[] {
  const sequences = new Map<string, FilterSequence>();
  for (const element of document.querySelectorAll<HTMLElement>('[data-warm-filters]'))
    for (const sequence of JSON.parse(element.dataset.warmFilters ?? '[]') as FilterSequence[])
      sequences.set(sequence.join('|'), sequence);
  return [...sequences.values()];
}

enhance('[data-figure-warmup-sources]', startWarmup);

function startWarmup(host: HTMLElement) {
  // Previews open on hover, so on a screen without hover they are not drawn ahead; nor is
  // anything drawn ahead for a visitor saving data.
  const hoverOnly = host.hasAttribute('data-figure-warmup-hover');
  if (hoverOnly && !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  const sources = JSON.parse(host.dataset.figureWarmupSources ?? '[]') as FigureSource[];
  const version = host.dataset.figureWarmupVersion ?? '';
  void warmInTurn(sources, version, readDeclaredFilters());
}
