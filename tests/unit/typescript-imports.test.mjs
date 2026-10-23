import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTypeScriptSpecifier } from '../helpers/typescript-imports.mjs';

test('Node test imports add extensions before query/hash and preserve explicit modules', () => {
  for (const [specifier, expected] of [
    ['./motion', './motion.ts'],
    ['../motion?case=1', '../motion.ts?case=1'],
    ['./motion#frame', './motion.ts#frame'],
    ['./motion?case=1#frame', './motion.ts?case=1#frame'],
    ['./motion.ts?case=1', './motion.ts?case=1'],
    ['./record.json#source', './record.json#source'],
    ['node:test', 'node:test'],
    ['linkedom', 'linkedom'],
  ])
    assert.equal(resolveTypeScriptSpecifier(specifier), expected);
});
