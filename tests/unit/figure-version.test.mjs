import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { figureVersion } from '../../src/data/research/figure-version.ts';

test('figure versions are independent of the command working directory', () => {
  const source = new URL('../../src/data/research/figure-version.ts', import.meta.url).href;
  const script = `const { figureVersion } = await import(${JSON.stringify(source)}); process.stdout.write(figureVersion);`;
  const fromElsewhere = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: tmpdir(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(fromElsewhere, figureVersion);
});
