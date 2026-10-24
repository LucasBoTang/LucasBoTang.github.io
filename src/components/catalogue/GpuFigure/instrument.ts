import recording from '../../../data/research/rail4284-convergence.json';
import { createFigureClock } from '../../../lib/figure-clock.ts';
import { createFigureDrawReporter, whenFigureReady } from '../../../lib/figure-ready';
import {
  convergenceCycleAt,
  convergenceTiming,
  createConvergenceModel,
} from './convergence-model.ts';
import { createInstrumentView } from './instrument-view.ts';

/** Wire one instrument's recorded model, presentation, and visibility-aware clock. */
export function initializeInstrument(root: HTMLElement) {
  const reportDraw = createFigureDrawReporter(root);
  const model = createConvergenceModel(recording);
  const view = createInstrumentView(root, model);
  const playback = createFigureClock(
    root,
    (elapsedMs, reducedMotion) => {
      const cycle = convergenceCycleAt(elapsedMs, reducedMotion);
      view.render(model.sample(cycle.elapsedMs, reducedMotion), reducedMotion, cycle.opacity);
      reportDraw();
    },
    {
      threshold: 0.05,
      reducedTime: convergenceTiming.reducedTimeMs,
      startWhen: whenFigureReady,
    },
  );
  new ResizeObserver(() => {
    view.resize();
    playback.redraw();
  }).observe(view.svg);
  root.dataset.instrumentReady = 'true';
}
