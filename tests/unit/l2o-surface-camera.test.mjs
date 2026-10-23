import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSurfaceCamera,
  projectSurfacePoint,
} from '../../src/components/catalogue/L2oFigure/surface-camera.ts';
import { createSurfaceModel } from '../../src/components/catalogue/L2oFigure/surface-model.ts';

const { worldPoint } = createSurfaceModel({ a: 3.898444652557373, b: 5.810980796813965 });
const samples = [-3, -2, -1, 0, 0.5].flatMap((x) =>
  [-1.3, 0, 2, 4, 5.7].map((y) => worldPoint(x, y)),
);

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10);

test('surface camera fits the drawing with its fixed top and horizontal optical offsets', () => {
  const projection = createSurfaceCamera(samples, worldPoint);
  for (const [width, height] of [
    [600, 390],
    [320, 300],
    [900, 650],
  ]) {
    const camera = projection.fit(width, height);
    const projected = samples.map((point) => projectSurfacePoint(point, camera));
    const xs = projected.map(([x]) => x);
    const ys = projected.map(([, y]) => y);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    close((minX + maxX) / 2, width / 2 - 8);
    close(minY, 16);
    assert.ok(maxX - minX <= width - 30 + 1e-10);
    assert.ok(maxY - minY <= height - 38 + 1e-10);
    assert.ok(
      Math.abs(maxX - minX - (width - 30)) < 1e-10 || Math.abs(maxY - minY - (height - 38)) < 1e-10,
      'one dimension must use the available drawing envelope',
    );
  }
});

test('surface labels and trajectory distances share the same orthographic axes after resize', () => {
  const projection = createSurfaceCamera(samples, worldPoint);
  const from = samples[2];
  const to = samples[18];
  const distance = Math.hypot(
    ...[projection.right, projection.up].map((axis) =>
      axis.reduce((sum, value, i) => sum + (to[i] - from[i]) * value, 0),
    ),
  );
  for (const [width, height] of [
    [600, 390],
    [320, 300],
  ]) {
    const camera = projection.fit(width, height);
    const a = projectSurfacePoint(from, camera);
    const b = projectSurfacePoint(to, camera);
    close(Math.hypot(b[0] - a[0], b[1] - a[1]) / camera.scale, distance);
    const behind = from.map((value, i) => value + camera.forward[i] * 3);
    const projectedBehind = projectSurfacePoint(behind, camera);
    close(projectedBehind[0], a[0]);
    close(projectedBehind[1], a[1]);
  }
});
