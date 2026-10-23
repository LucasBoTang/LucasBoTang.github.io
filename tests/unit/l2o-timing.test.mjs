import assert from 'node:assert/strict';
import test from 'node:test';
import {
  trainingTimeline,
  trainingSignals,
  trainingReset,
  trainingCadence,
  surfaceOpacityAt,
} from '../../src/components/catalogue/L2oFigure/timing.ts';

const lengths = [0.485, 1.061, 0.404, 1.832, 0.481, 0.827, 0.737];

test('all visible segments travel at one speed, including across checkpoint boundaries', () => {
  const timeline = trainingTimeline(lengths);
  lengths.forEach((length, i) =>
    assert.ok(
      Math.abs(length / (timeline.arrivals[i + 1] - timeline.arrivals[i]) - timeline.speed) < 1e-9,
    ),
  );
  assert.ok(
    timeline.arrivals[3] - timeline.arrivals[2] < timeline.arrivals[4] - timeline.arrivals[3],
  );
});
test('dashboard stages fit the actual travel interval in causal order', () => {
  const timeline = trainingTimeline(lengths);
  timeline.beats.forEach((beat, i) => {
    const times = [
      beat.mapping,
      beat.relaxed,
      beat.hidden,
      beat.continuous,
      beat.integer,
      beat.loss,
    ];
    assert.ok(times.every((t, j) => j === 0 || t > times[j - 1]));
    assert.equal(beat.integer, timeline.arrivals[2 * i + 1]);
    if (i) assert.ok(beat.mapping >= timeline.beats[i - 1].end);
  });
});
test('light arrivals and network scan ends trigger the readout refresh', () => {
  for (const beat of trainingTimeline(lengths).beats) {
    const signals = trainingSignals(beat);
    assert.equal(signals.mappingScan[1], beat.relaxed);
    assert.equal(signals.correction[1], signals.correctionScan[0]);
    assert.equal(signals.correctionScan[1], beat.hidden);
    assert.equal(signals.update[0], beat.hidden);
    assert.equal(signals.loss[1], beat.loss);
    assert.ok(Object.values(signals).every(([from, to]) => to > from));
  }
});
test('the path never waits for the dashboard between adjacent segments', () => {
  const { arrivals, starts } = trainingTimeline(lengths);
  for (let i = 1; i < arrivals.length; i++) assert.equal(starts[i], arrivals[i - 1]);
});
test('the final result holds before the quiet ordered reset', () => {
  const timeline = trainingTimeline(lengths),
    reset = trainingReset(timeline.cycle);
  assert.ok(reset.relaxed > timeline.beats.at(-1).loss + trainingCadence.action);
  const phases = Object.values(reset);
  assert.ok(phases.every((t, i) => !i || t - phases[i - 1] >= 0.13));
  assert.ok(reset.hud + 0.35 < timeline.cycle);
});

test('the lower flow keeps one readable cadence across all recorded checkpoints', () => {
  const { beats } = trainingTimeline(lengths);
  assert.ok(trainingCadence.reading + trainingCadence.stagger < trainingCadence.pulse * 2);
  const reference = Object.values(trainingSignals(beats[0])).map(([a, b]) => b - a);
  for (const beat of beats) {
    const intervals = Object.values(trainingSignals(beat)).map(([a, b]) => b - a);
    intervals.forEach((duration, i) => assert.ok(Math.abs(duration - reference[i]) < 1e-9));
    intervals.forEach((duration) => assert.ok(Math.abs(duration - trainingCadence.pulse) < 1e-9));
    assert.equal(beat.rounding, beat.continuous);
    assert.ok(beat.rounding + trainingCadence.action <= beat.integer);
  }
});

test('surface breathes continuously between full and faint without flat holds', () => {
  const cycle = trainingTimeline(lengths).cycle;
  const breath = cycle / 4;
  assert.ok(breath > 4 && breath < 5);
  for (let repeat = 0; repeat < 4; repeat++) {
    const start = repeat * breath;
    const at = (fraction) => surfaceOpacityAt(start + fraction * breath, cycle);
    assert.ok(Math.abs(at(0) - 1) < 1e-12);
    assert.ok(Math.abs(at(0.58) - 0.48) < 1e-12);
    const fading = [0, 0.03, 0.2, 0.4, 0.55, 0.58].map(at);
    assert.ok(fading.every((value, i) => !i || value < fading[i - 1]));
    const returning = [0.58, 0.61, 0.7, 0.8, 0.97, 1].map(at);
    assert.ok(returning.every((value, i) => !i || value > returning[i - 1]));
  }
});

test('surface breathing turns gently and rejoins continuously across training loops', () => {
  const cycle = trainingTimeline(lengths).cycle;
  const breath = cycle / 4;
  for (let i = 0; i <= 300; i++) {
    const phase = (i / 300) * cycle;
    const value = surfaceOpacityAt(phase, cycle);
    assert.ok(value >= 0.48 && value <= 1);
    assert.ok(Math.abs(value - surfaceOpacityAt(phase + breath, cycle)) < 1e-12);
    assert.ok(Math.abs(value - surfaceOpacityAt(phase - 0.001, cycle)) < 0.001);
  }
  for (const fraction of [0, 0.58, 1]) {
    const at = fraction * breath;
    const velocity =
      (surfaceOpacityAt(at + 0.001, cycle) - surfaceOpacityAt(at - 0.001, cycle)) / 0.002;
    assert.ok(Math.abs(velocity) < 0.001, 'the breath reverses without a sudden change in speed');
  }
});

test('reduced motion keeps the complete mathematical surface steady', () => {
  const cycle = trainingTimeline(lengths).cycle;
  for (const fraction of [0, 0.3, 0.5, 0.75, 1])
    assert.equal(surfaceOpacityAt(fraction * cycle, cycle, true), 1);
});
