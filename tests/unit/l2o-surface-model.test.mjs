import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendTube,
  createSurfaceModel,
  sphereVertices,
} from '../../src/components/catalogue/L2oFigure/surface-model.ts';
import { createSurfaceRenderer } from '../../src/components/catalogue/L2oFigure/surface-webgl.ts';

test('surface projection retains optimization coordinates and its continuous feasible boundary', () => {
  const model = createSurfaceModel({ a: 3.898444652557373, b: 5.810980796813965 });
  assert.deepEqual(model.worldPoint(-1.25, 2.2).slice(0, 2), [0, 0]);
  assert.equal(model.worldPoint(-1.25, 2.2, 0.045)[2], model.heightAt(-1.25, 2.2) + 0.045);
  assert.ok(Math.abs(model.objective(-1.7226116250568955, 3) - 31.649441637182292) < 1e-12);
  assert.equal(model.isFeasible(-Math.sqrt(5.810980796813965), 5.810980796813965 / 2), true);
  assert.equal(model.isFeasible(0.01, 3), false);
  assert.equal(model.isFeasible(-3, 3), false);
  assert.equal(model.isFeasible(-1, 2), false);
});

test('trajectory tubes and point meshes preserve the interleaved normal/color/arrival contract', () => {
  const vertices = [];
  const color = [0.2, 0.4, 0.6];
  appendTube(
    vertices,
    [
      [0, 0, 0],
      [1, 0, 0],
    ],
    color,
    0.1,
    [2, 4],
  );
  assert.equal(vertices.length, 6 * 6 * 10);
  for (let offset = 0; offset < vertices.length; offset += 10) {
    assert.ok(Math.abs(Math.hypot(...vertices.slice(offset + 3, offset + 6)) - 1) < 1e-12);
    assert.deepEqual(vertices.slice(offset + 6, offset + 9), color);
    assert.ok(vertices[offset + 9] === 2 || vertices[offset + 9] === 4);
    assert.equal(vertices[offset], vertices[offset + 9] === 2 ? 0 : 1);
  }
  const point = [2, 3, 4],
    radius = 0.046;
  const sphere = sphereVertices(point, radius, color);
  for (let offset = 0; offset < sphere.length; offset += 10) {
    assert.ok(
      Math.abs(Math.hypot(...point.map((value, axis) => sphere[offset + axis] - value)) - radius) <
        1e-12,
    );
    assert.equal(
      sphere[offset + 9],
      -100,
      'point meshes remain visible independent of the trace arrival attribute',
    );
  }
});

test('the WebGL upload and draw boundary binds attributes actually declared by its shader', () => {
  const calls = [];
  let id = 0;
  const gpu = new Proxy(
    {},
    {
      get(_, name) {
        if (/^[A-Z_0-9]+$/.test(name)) return name;
        return (...args) => {
          calls.push([name, ...args]);
          if (name.startsWith('create')) return { id: ++id };
          if (name === 'getShaderParameter' || name === 'getProgramParameter') return true;
          if (name === 'getUniformLocation') return args[1];
          if (name === 'getAttribLocation')
            return calls.filter(([method]) => method === name).length - 1;
        };
      },
    },
  );
  const renderer = createSurfaceRenderer(gpu, { a: 3.9, b: 5.8 });
  const shader = calls
    .filter(([method]) => method === 'shaderSource')
    .map(([, , text]) => text)
    .join('\n');
  for (const [, , name] of calls.filter(([method]) => method === 'getAttribLocation'))
    assert.match(shader, new RegExp(`attribute\\s+\\w+\\s+${name};`));
  const vertices = Array.from({ length: 60 }, (_, i) => i / 10);
  const mesh = renderer.createMesh(vertices, 1);
  assert.equal(mesh.count, 6);
  assert.deepEqual(
    [...calls.find(([method]) => method === 'bufferData')[2]],
    [...new Float32Array(vertices)],
  );
  renderer.drawMesh(mesh, 2.5, 0.7, [1, 2, 3]);
  assert.deepEqual(
    calls
      .filter(([method]) => method === 'vertexAttribPointer')
      .map(([, , width, , , stride, offset]) => [width, stride, offset]),
    [
      [3, 40, 0],
      [3, 40, 12],
      [3, 40, 24],
      [1, 40, 36],
    ],
  );
  assert.deepEqual(
    calls.find(([method]) => method === 'drawArrays'),
    ['drawArrays', 'TRIANGLES', 0, 6],
  );
});
