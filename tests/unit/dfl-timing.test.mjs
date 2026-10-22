import assert from 'node:assert/strict';
import test from 'node:test';
import {
  configureFlow,
  timing,
  flowSpeed,
  simplexDurations,
  simplexVertexPause,
  neuralLayerPause,
  captionSweepDuration,
  qualityDarkPause,
} from '../../src/components/catalogue/DflFigure/timeline.ts';

test('DFL forward and reverse handoffs remain continuous at desktop and mobile scales', () => {
  for (const { lengths, width, scale } of [
    { lengths: [160, 105, 170, 0], width: 120, scale: 0.39 },
    { lengths: [110, 160, 60, 0], width: 135, scale: 0.32 },
  ]) {
    const reverse = configureFlow(lengths, width, scale);
    const duration = ([start, end]) => end - start;
    assert.equal(timing.neural, timing.input[1]);
    assert.equal(timing.optimization, timing.prediction[1]);
    assert.equal(timing.evaluation, timing.decision[1]);
    [timing.input, timing.prediction, timing.decision].forEach((window, i) => {
      assert.ok(Math.abs(lengths[i] / duration(window) - flowSpeed) < 1e-8);
    });
    const walk =
      simplexDurations(scale, flowSpeed).reduce((sum, item) => sum + item, 0) +
      3 * simplexVertexPause;
    assert.ok(Math.abs(timing.decision[0] - timing.optimization - walk) < 1e-8);
    assert.equal(reverse[2][1], timing.reverseOptimization[0]);
    assert.equal(timing.reverseOptimization[1], reverse[1][0]);
    assert.equal(reverse[1][1], timing.reverse);
    assert.equal(timing.backward[0], timing.loss[1] + 2 * captionSweepDuration + qualityDarkPause);
    assert.ok(timing.cycle > timing.reverse + 3 * timing.neuralStep + 4 * neuralLayerPause);
  }
});
