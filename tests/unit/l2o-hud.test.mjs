import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createPredictionHud,
  predictionHudAt,
} from '../../src/components/catalogue/L2oFigure/hud.ts';
import {
  trainingTimeline,
  trainingReset,
} from '../../src/components/catalogue/L2oFigure/timing.ts';

const recording = JSON.parse(
  readFileSync(
    new URL('../../src/data/research/l2o-training-snapshots.json', import.meta.url),
    'utf8',
  ),
);
const snapshots = createPredictionHud(recording);
const timeline = trainingTimeline([0.485, 1.061, 0.404, 1.832, 0.481, 0.827, 0.737]);
const clearAt = trainingReset(timeline.cycle).hud;

test('each HUD snapshot describes the corrected point of one recorded checkpoint', () => {
  assert.deepEqual(
    snapshots.map((n) => n.step),
    [100, 200, 500, 9000],
  );
  assert.deepEqual(
    snapshots.map((n) => n.status),
    ['Infeasible', 'Infeasible', 'Integer feasible', 'Integer feasible'],
  );
  snapshots.forEach((n, i) => assert.deepEqual(n.point, recording.corrected[i]));
});
test('a relaxed arrival does not publish a completed checkpoint or change its status', () => {
  assert.equal(
    predictionHudAt(snapshots, timeline.arrivals, timeline.beats[0].relaxed, clearAt),
    null,
  );
  for (let i = 1; i < snapshots.length; i++) {
    assert.equal(
      predictionHudAt(snapshots, timeline.arrivals, timeline.beats[i].relaxed, clearAt),
      snapshots[i - 1],
    );
    assert.equal(
      predictionHudAt(snapshots, timeline.arrivals, timeline.beats[i].integer - 0.001, clearAt),
      snapshots[i - 1],
    );
  }
});
test('step and status commit together exactly when the integer point arrives', () => {
  timeline.beats.forEach((beat, i) => {
    assert.equal(
      predictionHudAt(snapshots, timeline.arrivals, beat.integer, clearAt),
      snapshots[i],
    );
    assert.equal(predictionHudAt(snapshots, timeline.arrivals, beat.loss, clearAt), snapshots[i]);
  });
});
test('one loop has four stable snapshots and one clear, without transient relaxed statuses', () => {
  const commits = [];
  let previous = null;
  for (let t = 0; t < timeline.cycle; t += 0.01) {
    const snapshot = predictionHudAt(snapshots, timeline.arrivals, t, clearAt);
    if (snapshot !== previous) {
      commits.push(snapshot?.step ?? null);
      previous = snapshot;
    }
  }
  assert.deepEqual(commits, [100, 200, 500, 9000, null]);
  assert.equal(predictionHudAt(snapshots, timeline.arrivals, clearAt, clearAt), null);
});
