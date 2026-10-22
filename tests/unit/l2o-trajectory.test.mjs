import assert from 'node:assert/strict';
import test from 'node:test';
import {
  trajectoryLengths,
  trajectoryPoint,
  trajectoryProgress,
  trajectoryTime,
} from '../../src/components/catalogue/L2oFigure/trajectory.ts';

test('travel follows visible arc length instead of the spacing of surface samples', () => {
  const points = [
    [0, 0, 0],
    [0, 2, 0],
    [8, 2, 0],
  ];
  const lengths = trajectoryLengths(points, (p) => [p[0], p[1]]);
  assert.deepEqual(lengths, [0, 2, 10]);
  assert.deepEqual(trajectoryPoint(points, lengths, 0.5), [3, 2, 0]);
});
test('the reveal front and moving marker use inverse mappings of the same progress', () => {
  for (let i = 0; i <= 100; i++) {
    const p = i / 100;
    assert.ok(Math.abs(trajectoryProgress(trajectoryTime(p)) - p) < 1e-6);
  }
});
test('travel does not brake to a stop at every sparse checkpoint', () => {
  for (let i = 0; i < 100; i++) {
    const speed = (trajectoryProgress((i + 1) / 100) - trajectoryProgress(i / 100)) * 100;
    assert.ok(Math.abs(speed - 1) < 1e-12);
  }
  const points = [
    [1, 2, 3],
    [1, 2, 3],
  ];
  assert.deepEqual(trajectoryPoint(points, [0, 0], 0.7), [1, 2, 3]);
});
