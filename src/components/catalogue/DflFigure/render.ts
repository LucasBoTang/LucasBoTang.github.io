import { createFigureClock } from '../../../lib/figure-clock';
import { whenFigureReady } from '../../../lib/figure-ready';
import { ambientSwing, updateDatasetAmbient } from './ambient';
import { drawDecisionBalance } from './balance';
import { prepareModuleFrame, type ModuleSurface } from './drawing';
import { updateDflFlow } from './flow-layout';
import { drawNeuralNetwork } from './neural-network';
import { drawOptimization } from './optimization';
import { flowPhase, timing } from './timeline';

function renderModule(surface: ModuleSurface, time: number, ambient: number) {
  const drawing = prepareModuleFrame(surface);
  if (!drawing) return;
  const { canvas, ctx } = surface;
  const { screenStroke } = drawing;
  const flow = flowPhase(time);
  if (canvas.dataset.module === 'predict') {
    drawNeuralNetwork(drawing, flow, ambient);
  } else if (canvas.dataset.module?.startsWith('optimize')) {
    drawOptimization(surface, drawing, flow, ambient);
  } else {
    let sweep: number | null = null;
    if (flow >= timing.evaluation && flow < timing.evaluation + 0.6)
      sweep = (flow - timing.evaluation) / 0.6;
    if (flow >= timing.backward[0] - 0.6 && flow < timing.backward[0])
      sweep = 1 - (flow - (timing.backward[0] - 0.6)) / 0.6;
    drawDecisionBalance(ctx, ambient, sweep, screenStroke(2.4));
  }
}

// One clock drives every module and wire. Geometry is measured only on resize.
const root = document.querySelector<HTMLElement>('.dfl-composition');
if (root) {
  const sign = root.querySelector<HTMLElement>('.dfl-sign');
  const surfaces = Array.from(root.querySelectorAll<HTMLCanvasElement>('canvas')).flatMap(
    (canvas) => {
      const ctx = canvas.getContext('2d');
      const formula = canvas.parentElement!.querySelector<HTMLElement>('.opt-formula');
      if (formula) {
        formula.style.left = '0px';
        formula.style.top = '0px';
      }
      return ctx
        ? [
            {
              canvas,
              ctx,
              box: { width: 0, height: 0 },
              formula,
            },
          ]
        : [];
    },
  );
  const draw = (elapsed: number, reduced: boolean) => {
    const time = reduced ? 0 : elapsed / 1000;
    surfaces.forEach((surface) => renderModule(surface, time, time));
    // The two lines share a smooth light cycle, about 75–93% opacity, without going dark.
    const light = 0.2 + 0.08 * ambientSwing(time) + 0.015 * ambientSwing(time * 1.7, 0.9);
    sign?.style.setProperty('--sign-light', light.toFixed(4));
    updateDatasetAmbient(root, time);
    updateDflFlow(time, reduced);
  };
  const clock = createFigureClock(root, draw, { startWhen: whenFigureReady });
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const surface = surfaces.find((item) => item.canvas === entry.target)!;
      surface.box = { width: entry.contentRect.width, height: entry.contentRect.height };
    }
    clock.redraw();
  });
  surfaces.forEach(({ canvas }) => observer.observe(canvas));
  root.addEventListener('dfl:layout', () => clock.redraw());
}
