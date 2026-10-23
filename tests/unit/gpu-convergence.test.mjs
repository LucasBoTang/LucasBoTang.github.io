import assert from 'node:assert/strict';
import test from 'node:test';
import recording from '../../src/data/research/rail4284-convergence.json' with { type: 'json' };
import { GET } from '../../src/pages/data/research/rail4284-convergence.json.ts';

test('the public convergence download preserves every canonical sample and its provenance', async () => {
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(await response.json(), recording);
});
