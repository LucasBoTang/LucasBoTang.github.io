import assert from 'node:assert/strict';
import test from 'node:test';
import { createWarmupMemory } from '../../src/components/catalogue/FigureWarmup/warmup-memory.ts';
import { installGlobals } from '../helpers/browser.mjs';

function storage(t, initial) {
  let saved = initial;
  installGlobals(t, {
    localStorage: {
      getItem: () => saved,
      setItem: (key, value) => {
        assert.equal(key, 'figure-warmup');
        saved = value;
      },
    },
  });
  return () => JSON.parse(saved);
}

test('warm-up memory owns versioned keys, retains this version and deduplicates writes', (t) => {
  const saved = storage(t, JSON.stringify(['/figures/a/#v1', '/figures/b/#v2']));
  const memory = createWarmupMemory('v2');
  assert.equal(memory.has('/figures/a/'), false);
  assert.equal(memory.has('/figures/b/'), true);
  memory.remember('/figures/a/');
  memory.remember('/figures/a/');
  assert.deepEqual(saved(), ['/figures/b/#v2', '/figures/a/#v2']);
});

test('warm-up memory treats corrupt storage as empty and ignores invalid entries', (t) => {
  const saved = storage(t, 'invalid JSON');
  const memory = createWarmupMemory('v2');
  assert.equal(memory.has('/figures/a/'), false);
  memory.remember('/figures/a/');
  assert.deepEqual(saved(), ['/figures/a/#v2']);
  localStorage.setItem('figure-warmup', '[null, 3, "/figures/b/#v2"]');
  memory.remember('/figures/a/');
  assert.deepEqual(saved(), ['/figures/b/#v2', '/figures/a/#v2']);
});

test('blocked storage cannot prevent figure warm-up', (t) => {
  installGlobals(t, {
    localStorage: {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    },
  });
  const memory = createWarmupMemory('v2');
  assert.equal(memory.has('/figures/a/'), false);
  assert.doesNotThrow(() => memory.remember('/figures/a/'));
});
