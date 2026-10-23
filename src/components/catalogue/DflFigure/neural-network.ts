import { smoothstep as smooth } from '../../../lib/easing.ts';
import { ambientSwing } from './ambient';
import type { ModuleDrawing, Point2D } from './drawing';
import { networkGeometry } from './geometry';
import { neonMetrics } from './material';
import { neuralLayerPause, timing } from './timeline';

const wake = (age: number) => {
  if (age <= 0) return 0;
  const u = Math.min(1, age / 0.09);
  return u * u * (3 - 2 * u) * Math.exp(-Math.pow(Math.max(0, age - 0.09) / 0.28, 2));
};

/** Render the forward and backward signals through the rotating network. */
export function drawNeuralNetwork(drawing: ModuleDrawing, flow: number, ambient: number) {
  const { line, dot } = drawing;
  const yaw = 0.32 + ambientSwing(ambient, 0.22) * 0.18,
    pitch = 0.1 + ambientSwing(ambient, 0.22 + Math.PI / 2) * 0.065;
  const counts = [3, 5, 5, 3],
    layers: Point2D[][] = counts.map((n, k) =>
      Array.from({ length: n }, (_, j) => {
        const x = -networkGeometry.halfWidth + k * networkGeometry.layerStep,
          y = (j - (n - 1) / 2) * networkGeometry.rowStep;
        const z = Math.sin(k * 1.7 + j * 0.9) * 16;
        const depth = -x * Math.sin(yaw) + z * Math.cos(yaw);
        return [
          x * Math.cos(yaw) + z * Math.sin(yaw),
          y * Math.cos(pitch) - depth * Math.sin(pitch),
        ] as Point2D;
      }),
    );
  // All edges between the same layers share a travelling pulse. Sample it once per layer,
  // retaining each edge's existing intensity and the original drawing order.
  const pulses = layers.slice(0, -1).map((_, k) => {
    const forward =
      (flow - timing.neural - k * (timing.neuralStep + neuralLayerPause) - neuralLayerPause) /
      timing.neuralStep;
    const backward =
      (flow -
        timing.reverse -
        (2 - k) * (timing.neuralStep + neuralLayerPause) -
        neuralLayerPause) /
      timing.neuralStep;
    return Array.from({ length: 16 }, (_, s) => {
      const u = (s + 0.5) / 16;
      return Math.max(wake(forward - u), wake(backward - (1 - u)));
    });
  });
  layers.slice(0, -1).forEach((layer, k) =>
    layer.forEach((a, j) =>
      layers[k + 1].forEach((b, l) => {
        line(a, b, 0.28, 'structure');
        for (let s = 0; s < 16; s++) {
          const active = pulses[k][s];
          if (active > 0.01)
            line(
              [a[0] + ((b[0] - a[0]) * s) / 16, a[1] + ((b[1] - a[1]) * s) / 16],
              [a[0] + ((b[0] - a[0]) * (s + 1)) / 16, a[1] + ((b[1] - a[1]) * (s + 1)) / 16],
              active * (0.28 + ((j * 3 + l) % 4) * 0.06),
              'signal',
            );
        }
      }),
    ),
  );
  layers.forEach((layer, k) =>
    layer.forEach((p) => {
      const forwardArrival = timing.neural + k * (timing.neuralStep + neuralLayerPause),
        reverseArrival = timing.reverse + (3 - k) * (timing.neuralStep + neuralLayerPause);
      const layerFlash = (age: number) =>
        smooth(age / 0.06) * (1 - smooth((age - neuralLayerPause) / 0.16));
      const active = Math.max(layerFlash(flow - forwardArrival), layerFlash(flow - reverseArrival));
      dot(
        p,
        neonMetrics.nodeRadius + active * neonMetrics.nodePulse,
        0.45 + active * 0.55,
        active * 8,
      );
    }),
  );
}
