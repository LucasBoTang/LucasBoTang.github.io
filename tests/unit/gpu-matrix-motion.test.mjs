import assert from 'node:assert/strict';
import test from 'node:test';
import { matrixMotionAt } from '../../src/components/catalogue/GpuFigure/matrix-motion.ts';

test('GPU matrix scan completes before its result and output arrows appear', () => {
  const scanning = matrixMotionAt(1050, false);
  assert.equal(scanning.inputOpacity, 1);
  assert.equal(scanning.resultOpacity, 0);
  assert.ok(Math.abs(scanning.scanProgress - 0.5) < 1e-12);
  assert.equal(scanning.downScanOpacity, 1);
  assert.equal(scanning.rightScanOpacity, 0);
  assert.equal(scanning.outputArrowOpacity, 0);
  assert.equal(scanning.indicatorOpacity, 0.85);
  assert.equal(scanning.chipOpacity, 0.9);
  const result = matrixMotionAt(1800, false);
  assert.equal(result.scanProgress, 1);
  assert.equal(result.downScanOpacity, 0);
  assert.equal(result.rightScanOpacity, 0);
  assert.ok(result.resultOpacity > 0);
  assert.equal(result.outputArrowOpacity, 1);
});

test('GPU multiplication directions share choreography and a clear interval before switching', () => {
  const forward = matrixMotionAt(1050, false);
  const transpose = matrixMotionAt(3750, false);
  assert.equal(forward.phase, 0);
  assert.equal(transpose.phase, 1);
  assert.equal(transpose.rightScanOpacity, forward.downScanOpacity);
  assert.equal(transpose.downScanOpacity, 0);
  assert.equal(transpose.transposeProductOpacity, forward.productOpacity);
  assert.equal(transpose.productOpacity, 0);
  for (const field of [
    'inputOpacity',
    'resultOpacity',
    'scanProgress',
    'inputFlow',
    'outputFlow',
    'indicatorOpacity',
    'chipOpacity',
    'busOpacity',
    'busOffset',
  ])
    assert.deepEqual(transpose[field], forward[field]);
  assert.deepEqual(matrixMotionAt(6450, false), forward);
  for (const elapsed of [2500, 2699, 2700, 5200, 5399, 5400]) {
    const frame = matrixMotionAt(elapsed, false);
    for (const field of [
      'inputOpacity',
      'resultOpacity',
      'downScanOpacity',
      'rightScanOpacity',
      'outputArrowOpacity',
      'indicatorOpacity',
      'chipOpacity',
      'busOpacity',
      'productOpacity',
      'transposeProductOpacity',
    ])
      assert.equal(frame[field], 0, `${field} must be clear at ${elapsed}ms`);
  }
});

test('GPU reduced motion hides scans, flow and hardware activity at every supplied phase', () => {
  for (const elapsed of [0, 650, 1050, 1800, 2500, 3750, 4500, 5400]) {
    const frame = matrixMotionAt(elapsed, true);
    for (const field of [
      'downScanOpacity',
      'rightScanOpacity',
      'outputArrowOpacity',
      'indicatorOpacity',
      'chipOpacity',
      'busOpacity',
      'productOpacity',
      'transposeProductOpacity',
    ])
      assert.equal(frame[field], 0, `${field} must be hidden at ${elapsed}ms`);
    assert.equal(frame.inputFlow.reveal, 0);
    assert.equal(frame.outputFlow.reveal, 0);
  }
});
