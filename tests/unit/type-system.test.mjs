import assert from 'node:assert/strict';
import test from 'node:test';
import { checkTypeSystem } from '../../scripts/type-system.mjs';

const inStyle = (css) => `---\n---\n\n<p>Text</p>\n\n<style>\n${css}\n</style>\n`;

test('flags a font size that is not a tier token', () => {
  assert.deepEqual(checkTypeSystem('src/a.css', '.a {\n  font-size: 0.9375rem;\n}'), [
    '2: font-size: 0.9375rem',
  ]);
});

test('accepts tier tokens for size and leading', () => {
  const css = '.a {\n  font-size: var(--type-body);\n  line-height: var(--line-body);\n}';
  assert.deepEqual(checkTypeSystem('src/a.css', css), []);
});

test('flags bold', () => {
  assert.equal(checkTypeSystem('src/a.css', '.a {\n  font-weight: 500;\n}').length, 1);
});

test('allows uppercase only in global.css', () => {
  const css = '.a {\n  text-transform: uppercase;\n}';
  assert.equal(checkTypeSystem('src/components/X.astro', inStyle(css)).length, 1);
  assert.deepEqual(checkTypeSystem('src/styles/global.css', css), []);
});

test('counts lines through the whole component file', () => {
  const found = checkTypeSystem('src/components/X.astro', inStyle('.a {\n  font-weight: 700;\n}'));
  assert.deepEqual(found, ['8: font-weight: 700']);
});

test('flags literal spacing unless marked optical', () => {
  assert.equal(checkTypeSystem('src/a.css', '.a {\n  margin-top: 2.25rem;\n}').length, 1);
  assert.deepEqual(checkTypeSystem('src/a.css', '.a {\n  transform: translateX(2px);\n}'), []);
  assert.deepEqual(
    checkTypeSystem('src/a.css', '.a {\n  padding-left: 18px; /* optical: the ink shift */\n}'),
    [],
  );
  assert.deepEqual(checkTypeSystem('src/a.css', '.a {\n  gap: var(--step-24);\n}'), []);
  assert.deepEqual(checkTypeSystem('src/a.css', '.a {\n  margin: 0 auto;\n}'), []);
  assert.deepEqual(
    checkTypeSystem('src/a.css', '.a {\n  margin-left: calc(-1 * var(--step-8));\n}'),
    [],
  );
});

test('exempts artwork from size and weight', () => {
  const css = '.a {\n  font-size: 0.88em;\n  font-weight: 450;\n}';
  const path = 'src/components/catalogue/ProjectWordmark/ProjectWordmark.astro';
  assert.deepEqual(checkTypeSystem(path, inStyle(css)), []);
});

test('accepts the home name size', () => {
  assert.deepEqual(checkTypeSystem('src/a.css', '.a {\n  font-size: var(--type-name);\n}'), []);
});

test('accepts dedicated research lane size and leading', () => {
  const css = '.a {\n  font-size: var(--type-lane);\n  line-height: var(--line-lane);\n}';
  assert.deepEqual(checkTypeSystem('src/a.css', css), []);
});
