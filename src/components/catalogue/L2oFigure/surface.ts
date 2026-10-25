import recorded from '../../../data/research/l2o-training-snapshots.json';
import { smoothstep as smoothStep } from '../../../lib/easing.ts';
import { createFigureClock } from '../../../lib/figure-clock';
import { createFigureDrawReporter, whenFigureReady } from '../../../lib/figure-ready';
import { enhanceNear } from '../../../lib/lifecycle';
import { reducedMotionQuery } from '../../../lib/motion';
import { createPredictionHud, predictionHudAt } from './hud';
import { createReadoutWriter, createTrainingReadings } from './readouts';
import { createSurfaceScene } from './surface-scene';
import { trainingCadence, trainingReset } from './timing';
import { L2O_TICK_EVENT, type TrainingTickEvent } from './training-events';

// One visible composition owns one clock: the surface, legend and lower instruments stay in step.
enhanceNear<HTMLElement>('[data-l2o-surface]', initializeTrainingFigure);
async function initializeTrainingFigure(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('.surface-gl')!;
  const overlay = root.querySelector<HTMLCanvasElement>('.surface-annotations')!;
  let reducedMotion = reducedMotionQuery().matches;
  const createdScene = await createSurfaceScene(canvas, overlay, recorded).catch((error) => {
    console.warn('Could not initialize L2O figure', error);
    return null;
  });
  if (!createdScene) {
    root.querySelector<HTMLElement>('.surface-fallback')!.hidden = false;
    root.setAttribute('data-figure-drawn', 'fallback');
    return;
  }
  const scene = createdScene;
  const reportDraw = createFigureDrawReporter(root);
  const { arrivals, beats, cycle } = scene.timeline;
  const reset = trainingReset(cycle);
  const hudSnapshots = createPredictionHud(recorded);
  let elapsedSeconds = 0,
    lastHudIndex = -2;
  const stepSlot = root.querySelector<HTMLElement>('[data-training-step]')!;

  const legendKeys = Array.from(root.querySelectorAll<HTMLElement>('.surface-legend [data-kind]'));
  const stateSlot = root.querySelector<HTMLElement>('[data-feasibility]')!;

  const instrument = root.closest<HTMLElement>('[data-training-composition]');
  const activityTarget = instrument ?? root;
  const liveSlots = Array.from(instrument?.querySelectorAll<HTMLElement>('[data-reading]') ?? []);
  const readings = createTrainingReadings(recorded);
  const { update: updateReading, settle: settleReadouts } = createReadoutWriter(
    stepSlot,
    stateSlot,
    () => reducedMotion,
  );
  let previousPhase = -1;
  const revealedStages: Record<string, number> = {
    relaxed: -1,
    hidden: -1,
    integer: -1,
    loss: -1,
  };
  const readingStages: Record<string, string> = {
    'relaxed-x': 'relaxed',
    'relaxed-y': 'relaxed',
    'delta-x': 'hidden',
    'hidden-y': 'hidden',
    'integer-x': 'integer',
    'integer-y': 'integer',
    objective: 'loss',
    violation: 'loss',
    gap: 'loss',
  };
  function resize() {
    scene.resize();
    render();
  }
  function render() {
    const phase = reducedMotion ? arrivals[arrivals.length - 1] + 1 : elapsedSeconds % cycle;
    const fade = reducedMotion
      ? 1
      : 1 - smoothStep((phase - reset.relaxed) / (cycle - reset.relaxed));
    const hudSnapshot = predictionHudAt(hudSnapshots, arrivals, phase, reset.hud);
    let arrivedPoint = -1;
    for (let i = 0; i < arrivals.length; i++) if (phase >= arrivals[i]) arrivedPoint = i;
    for (const key of legendKeys) {
      const kind = arrivedPoint % 2 ? 'integer' : 'relaxed';
      key.classList.toggle(
        'is-arriving',
        !reducedMotion &&
          arrivedPoint >= 0 &&
          key.dataset.kind === kind &&
          phase - arrivals[arrivedPoint] < trainingCadence.action,
      );
    }
    scene.render({
      phase,
      opacity: fade,
      arrivedPoint,
      reducedMotion,
    });
    reportDraw();
    if (phase < previousPhase) {
      Object.keys(revealedStages).forEach((key) => (revealedStages[key] = -1));
      for (const slot of liveSlots) updateReading(slot, '—');
    }
    previousPhase = phase;
    let index = 0;
    for (let i = 1; i < beats.length; i++) if (phase >= beats[i].mapping) index = i;
    const beat = beats[index];
    const reading = readings[index];
    const reveal = (group: string, when: number, values: Record<string, string>) => {
      if (phase < when || revealedStages[group] === index) return;
      revealedStages[group] = index;
      for (const slot of liveSlots) {
        const value = values[slot.dataset.reading!];
        if (value !== undefined) updateReading(slot, value, true);
      }
    };
    reveal('relaxed', beat.relaxed, reading.relaxed);
    reveal('hidden', beat.hidden, reading.hidden);
    reveal('integer', beat.integer, reading.integer);
    reveal('loss', beat.loss, reading.loss);
    const hudIndex = hudSnapshot?.index ?? -1;
    if (hudIndex !== lastHudIndex) {
      lastHudIndex = hudIndex;
      updateReading(
        stepSlot,
        hudSnapshot ? String(hudSnapshot.step) : '\u2014',
        Boolean(hudSnapshot),
      );
      updateReading(stateSlot, hudSnapshot?.status ?? '\u2014');
    }
    if (!reducedMotion && phase >= reset.relaxed) {
      for (const slot of liveSlots) {
        const group = readingStages[slot.dataset.reading!] as keyof typeof reset;
        if (group && phase >= reset[group]) updateReading(slot, '—');
      }
    }
    instrument?.dispatchEvent(
      new CustomEvent<TrainingTickEvent['detail']>(L2O_TICK_EVENT, {
        detail: { t: phase, at: arrivedPoint, beat, index },
      }),
    );
  }
  new ResizeObserver(resize).observe(canvas);
  document.fonts.ready.then(resize);
  resize();
  createFigureClock(
    activityTarget,
    (elapsed, reduced) => {
      reducedMotion = reduced;
      elapsedSeconds = elapsed / 1000;
      render();
      if (reduced) settleReadouts([...liveSlots, stepSlot, stateSlot]);
    },
    { maxFrameDelta: 60, startWhen: whenFigureReady },
  );
}
