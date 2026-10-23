import shapes from '../../../data/research/dfl-polytopes.json' with { type: 'json' };

// One clock for the integrated figure; every hand-off starts at the prior arrival.
export const timing = {
  cycle: 22.5,
  rate: 1.3,
  input: [0.3, 1.2] as [number, number],
  neural: 1.2,
  neuralStep: 0.75,
  prediction: [3.75, 4.65] as [number, number],
  optimization: 4.65,
  decision: [9.9, 10.85] as [number, number],
  evaluation: 10.85,
  loss: [14.1, 14.85] as [number, number],
  backward: [15.8, 18] as [number, number],
  reverseOptimization: [17, 17.6] as [number, number],
  reverse: 18,
};
export function flowPhase(time: number) {
  return (time * timing.rate) % timing.cycle;
}

// Use one reference projection for timing; ambient rotation never changes the schedule.
export function simplexDurations(scale: number, speed: number) {
  const p = shapes[0].vertices.map(([x, y, z]) => [
    (x * Math.cos(0.43) + z * Math.sin(0.43)) * 68,
    (y * Math.cos(0.28) - (-x * Math.sin(0.43) + z * Math.cos(0.43)) * Math.sin(0.28)) * 68,
  ]);
  const walk = [7, 1, 2, 10, 8];
  return walk
    .slice(1)
    .map((v, k) => (Math.hypot(p[v][0] - p[walk[k]][0], p[v][1] - p[walk[k]][1]) * scale) / speed);
}
export const simplexVertexPause = 0.22;
export const neuralLayerPause = simplexVertexPause;
export const flowSpeed = 140;
export const captionSweepDuration = 0.6;
export const qualityDarkPause = 0.4;
export function configureFlow(lengths: number[], neuralWidth: number, polyScale: number) {
  const d = lengths.map((length) => length / flowSpeed);
  timing.input[0] = 0.3 + captionSweepDuration;
  timing.input[1] = timing.input[0] + d[0];
  timing.neural = timing.input[1];
  timing.neuralStep = neuralWidth / 3 / flowSpeed;
  timing.prediction[0] = timing.neural + 3 * timing.neuralStep + 4 * neuralLayerPause;
  timing.prediction[1] = timing.prediction[0] + d[1];
  timing.optimization = timing.prediction[1];
  timing.decision[0] =
    timing.optimization +
    simplexDurations(polyScale, flowSpeed).reduce((a, b) => a + b, 0) +
    3 * simplexVertexPause;
  timing.decision[1] = timing.decision[0] + d[2];
  timing.evaluation = timing.decision[1];
  timing.loss[0] = timing.evaluation;
  timing.loss[1] = timing.loss[0] + d[3];
  timing.backward[0] = timing.loss[1] + 2 * captionSweepDuration + qualityDarkPause;
  // Each reverse stage finishes before the following stage begins.
  const decisionReturn: [number, number] = [timing.backward[0], timing.backward[0] + d[2]];
  timing.reverseOptimization[0] = decisionReturn[1];
  timing.reverseOptimization[1] = timing.reverseOptimization[0] + captionSweepDuration;
  const predictionReturn: [number, number] = [
    timing.reverseOptimization[1],
    timing.reverseOptimization[1] + d[1],
  ];
  timing.backward[1] = predictionReturn[1];
  timing.reverse = predictionReturn[1];
  timing.cycle = timing.reverse + 3 * timing.neuralStep + 4 * neuralLayerPause + 1.2;
  return [
    null,
    predictionReturn,
    decisionReturn,
    [timing.backward[0], timing.backward[0]],
  ] as const;
}
