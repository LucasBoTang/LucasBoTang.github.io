import assert from 'node:assert/strict';
import test from 'node:test';
import { hexChannels, theme, themeVariables } from '../../src/data/theme.ts';

test('reads the channels of a hex colour', () => {
  assert.deepEqual(hexChannels('#6e8db8'), [110, 141, 184]);
});

test('derives translucent tints from the palette blue', () => {
  assert.equal(theme['rule-accent'], 'rgb(110 141 184 / 12%)');
  assert.equal(theme['blue-glow'], 'rgb(110 141 184 / 90%)');
});

test('blends the dim blue as the palette blue at 22% on the ink', () => {
  assert.equal(theme['blue-dim'], '#252c37');
});

test('writes every theme colour as a custom property', () => {
  for (const [name, value] of Object.entries(theme))
    assert.ok(themeVariables.includes(`--${name}: ${value}`), name);
});
