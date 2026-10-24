import { hasFigureDrawn } from '../../../lib/figure-ready.ts';
import { enhance } from '../../../lib/lifecycle';
import { openingPending, waitForOpeningVisible } from '../../../lib/opening-gate';
import { waitForIdleWindow } from './idle-window';

import { createWarmupMemory } from './warmup-memory';
import { warmFigures, type FigureSource, type FilterSequence } from './warmup-renderer';

// Visible content has priority; warm hidden figures only after the opening settles.
const INPUT_QUIET_MS = 600;
const MAX_OPENING_WAIT_MS = 8000;

/** Ignore warm-up slots when checking visible embeds. */
const findShownFigure = (src: string) =>
  [...document.querySelectorAll('iframe')].find(
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

let lastInputAt = -Infinity;
for (const type of [
  'scroll',
  'wheel',
  'touchmove',
  'pointermove',
  'pointerdown',
  'keydown',
  'input',
])
  addEventListener(type, () => (lastInputAt = performance.now()), {
    capture: true,
    passive: true,
  });

/** Hidden pages and recent input always take priority over speculative drawing. */
function waitForQuietMoment(startedAt: number) {
  return waitForIdleWindow(() => {
    const now = performance.now();
    return (
      !document.hidden &&
      now - lastInputAt > INPUT_QUIET_MS &&
      (isOpeningSettled() || now - startedAt > MAX_OPENING_WAIT_MS)
    );
  });
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
    const shown = findShownFigure(source.src);
    if (shown) {
      if (hasFigureDrawn(shown.contentDocument)) memory.remember(source.src);
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
