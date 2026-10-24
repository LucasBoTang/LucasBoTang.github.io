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
  const { canvas } = surface;
  const flow = flowPhase(time);
  if (canvas.dataset.module === 'predict') {
    drawNeuralNetwork(drawing, flow, ambient);
  } else if (canvas.dataset.module?.startsWith('optimize')) {
    drawOptimization(surface, drawing, flow, ambient);
  } else {
    let sweep: number | null = null;
    if (flow >= timing.evaluation && flow < timing.evaluation + 0.6)
      sweep = (flow - timing.evaluation) / 0.6;
    drawDecisionBalance(drawing, ambient, sweep);
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
    // Local light varies gently at two continuous rates; the lettering never switches off. The
    // sign's lettering, with its blurred shadows, is drawn again whenever the light changes, so
    // it is written in steps too small to see, a few times a second rather than every frame.
    const light = 0.2 + 0.12 * ambientSwing(time * 1.4) + 0.02 * ambientSwing(time * 1.9, 0.9);
    const lit = light.toFixed(2);
    if (sign && sign.style.getPropertyValue('--sign-light') !== lit)
      sign.style.setProperty('--sign-light', lit);
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
