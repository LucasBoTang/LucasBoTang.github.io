import assert from 'node:assert/strict';
import test from 'node:test';
import { createSurfaceProgram } from '../../src/components/catalogue/L2oFigure/surface-program.ts';
import { installGlobals } from '../helpers/browser.mjs';

function device({ parallel = true, linked = true, lost = false, pending = 1 } = {}) {
  const calls = [];
  const gpu = new Proxy(
    {},
    {
      get(_, name) {
        if (/^[A-Z_]+$/.test(name)) return name;
        return (...args) => {
          calls.push([name, ...args]);
          if (name.startsWith('create')) return {};
          if (name === 'getExtension')
            return parallel ? { COMPLETION_STATUS_KHR: 'COMPLETE' } : null;
          if (name === 'isContextLost') return lost;
          if (name === 'getProgramParameter')
            return args[1] === 'COMPLETE' ? pending-- <= 0 : linked;
          if (name === 'getShaderParameter') return linked;
          if (name === 'getShaderInfoLog') return 'bad shader';
        };
      },
    },
  );
  return { gpu, calls };
}

test('parallel compilation yields and checks link status only after completion', async () => {
  const { gpu, calls } = device();
  const work = createSurfaceProgram(gpu, 'vertex', 'fragment');
  assert.equal(calls.filter(([name]) => name === 'compileShader').length, 2);
  assert.equal(
    calls.some(([name, , status]) => name === 'getProgramParameter' && status === 'LINK_STATUS'),
    false,
  );
  await work;
  const queries = calls
    .filter(([name]) => name === 'getProgramParameter')
    .map(([, , status]) => status);
  assert.deepEqual(queries, ['COMPLETE', 'COMPLETE', 'LINK_STATUS']);
  assert.equal(
    calls.some(([name]) => name === 'getShaderParameter'),
    false,
  );
  assert.equal(calls.filter(([name]) => name === 'deleteShader').length, 2);
});

test('unsupported parallel compilation uses the link-status fallback', async () => {
  const { gpu, calls } = device({ parallel: false });
  await createSurfaceProgram(gpu, 'vertex', 'fragment');
  assert.deepEqual(
    calls.filter(([name]) => name === 'getProgramParameter').map(([, , status]) => status),
    ['LINK_STATUS'],
  );
});

test('failed compilation reports diagnostics and releases resources', async () => {
  const { gpu, calls } = device({ parallel: false, linked: false });
  await assert.rejects(createSurfaceProgram(gpu, 'vertex', 'fragment'), /bad shader/);
  assert.equal(calls.filter(([name]) => name === 'deleteProgram').length, 1);
  assert.equal(calls.filter(([name]) => name === 'deleteShader').length, 2);
});

test('context loss stops polling', async () => {
  const { gpu } = device({ lost: true });
  await assert.rejects(createSurfaceProgram(gpu, 'vertex', 'fragment'), /context lost/);
});

test('a stalled compiler cannot poll forever', async (t) => {
  let now = 0;
  installGlobals(t, {
    performance: {
      now: () => {
        const value = now;
        now += 10001;
        return value;
      },
    },
  });
  const { gpu } = device({ pending: Infinity });
  await assert.rejects(createSurfaceProgram(gpu, 'vertex', 'fragment'), /timed out/);
});
