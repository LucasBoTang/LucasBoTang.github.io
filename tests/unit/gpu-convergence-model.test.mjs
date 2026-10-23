import assert from 'node:assert/strict';
import test from 'node:test';
import {
  convergenceTiming,
  convergenceCycleAt,
  createConvergenceModel,
  formatConvergenceReadings,
} from '../../src/components/catalogue/GpuFigure/convergence-model.ts';
import recording from '../../src/data/research/rail4284-convergence.json' with { type: 'json' };

const model = createConvergenceModel(recording);
const endTime = convergenceTiming.leadInMs + convergenceTiming.traceDurationMs;

test('the trace lead-in retains waiting readings before the first measured iteration', () => {
  for (const elapsed of [0, convergenceTiming.leadInMs, 600]) {
    const frame = model.sample(elapsed, false);
    assert.equal(frame.started, false);
    assert.equal(frame.complete, false);
    assert.deepEqual(formatConvergenceReadings(frame, model.timeScale), {
      iteration: '—',
      time: '—',
      restarts: '00',
      channels: { primal: '—', dual: '—', gap: '—' },
      restarting: false,
    });
  }
});

test('continuous cursor interpolation retains the preceding recorded readout', () => {
  const frame = model.sample(9500, false);
  assert.equal(frame.iteration, 8900);
  assert.equal(frame.previous.iteration, 8800);
  assert.equal(frame.next.iteration, 9000);
  assert.equal(frame.fraction, 0.5);
  assert.deepEqual(formatConvergenceReadings(frame, model.timeScale), {
    iteration: '8,800',
    time: '1.6',
    restarts: '07',
    channels: { primal: '1.4e-3', dual: '3.7e-6', gap: '1.1e-7' },
    restarting: false,
  });
});

test('completion and reduced motion expose the same complete final measurement', () => {
  const final = model.sample(endTime, false);
  assert.equal(final.iteration, 17800);
  assert.equal(final.complete, true);
  assert.equal(final.reading, recording.points.at(-1));
  assert.deepEqual(model.sample(endTime + 60000, false), final);
  assert.deepEqual(model.sample(0, true), final);
  assert.deepEqual(formatConvergenceReadings(final, model.timeScale), {
    iteration: '17,800',
    time: '3.2',
    restarts: '09',
    channels: { primal: '9.1e-5', dual: '1.0e-6', gap: '2.6e-8' },
    restarting: false,
  });
});

test('restart presentation follows the measured sample and sampling preserves source data', () => {
  const before = JSON.stringify(recording);
  assert.equal(
    formatConvergenceReadings(model.sample(900, false), model.timeScale).restarting,
    true,
  );
  assert.equal(model.logFloor, -10);
  assert.equal(model.logCeiling, -1);
  for (let elapsed = 0; elapsed <= endTime; elapsed += 31) model.sample(elapsed, false);
  assert.equal(JSON.stringify(recording), before);
});

test('an empty recording is rejected before a view can consume missing samples', () => {
  assert.throws(() => createConvergenceModel({ ...recording, points: [] }), /at least one sample/);
});

test('KKT playback holds the final measurement, fades, and repeats the same recorded trace', () => {
  const cycleMs = 21000;
  const at = (time, reduced = false) => {
    const cycle = convergenceCycleAt(time, reduced);
    return { ...cycle, frame: model.sample(cycle.elapsedMs, reduced) };
  };
  assert.equal(at(0).opacity, 1, 'the first entrance retains its static first frame');
  assert.equal(at(20000).frame.complete, true);
  assert.equal(at(20000).opacity, 1, 'hold the completed result before fading');
  assert.ok(at(20700).opacity > 0 && at(20700).opacity < 1);
  assert.equal(at(20950).opacity, 0);
  assert.equal(at(cycleMs).frame.started, false);
  assert.equal(at(cycleMs).opacity, 0, 'reset while invisible');
  assert.ok(at(cycleMs + 200).opacity > 0 && at(cycleMs + 200).opacity < 1);
  assert.equal(at(cycleMs + 500).opacity, 1);
  for (const time of [900, 5000, 9500, 18500]) {
    assert.deepEqual(at(cycleMs + time).frame, at(time).frame);
    assert.deepEqual(at(cycleMs * 2 + time).frame, at(time).frame);
  }
  assert.equal(at(cycleMs, true).frame.complete, true);
  assert.equal(at(cycleMs, true).opacity, 1);
});
