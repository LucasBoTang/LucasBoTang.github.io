import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const css = readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8');

/** The custom properties of the first `:root` block, by name. */
const root = Object.fromEntries(
  [.../:root\s*\{([^}]*)\}/.exec(css)[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(
    ([, name, value]) => [name, value.trim()],
  ),
);
const remToPx = (value) => parseFloat(value) * 16;

test('defines the five sizes', () => {
  assert.equal(root['--type-label'], '0.75rem');
  assert.equal(root['--type-body'], '1rem');
  assert.equal(root['--type-heading'], '1.5rem');
  assert.equal(root['--type-title'], '3rem');
  assert.equal(root['--type-display'], '6rem');
});

test('puts every line height on a 4px baseline', () => {
  const lines = Object.entries(root).filter(([name]) => name.startsWith('--line-'));
  assert.ok(lines.length >= 6);
  for (const [name, value] of lines) {
    const px = value.startsWith('var(') ? remToPx(root[value.slice(4, -1)]) : remToPx(value);
    assert.equal(px % 4, 0, name);
  }
});

test('keeps spacing on the 8px scale', () => {
  const steps = Object.entries(root).filter(([name]) => name.startsWith('--step-'));
  assert.deepEqual(
    steps.map(([name]) => Number(name.slice(7))).sort((a, b) => a - b),
    [8, 16, 24, 32, 48, 64, 96, 160],
  );
  for (const [name, value] of steps) assert.equal(remToPx(value), Number(name.slice(7)), name);
});

test('defines the page grid', () => {
  assert.equal(root['--page-width'], '75rem');
  assert.match(css, /\.page-grid\s*\{[^}]*repeat\(12, minmax\(0, 1fr\)\)/);
});

const OLD_TOKEN =
  /--(text-(label|xs|sm|base|lg|xl|page-mobile)|space-\d|leading-(compact|body|prose)|tracking-label|reading-|page-width-(wide|reading))\b/;

/** Every source file under a directory. */
const sourceFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.(astro|css|ts)$/.test(entry.name)
        ? [path]
        : [];
  });

test('the old tokens are gone', () => {
  const src = fileURLToPath(new URL('../../src', import.meta.url));
  const stale = sourceFiles(src).filter((path) => OLD_TOKEN.test(readFileSync(path, 'utf8')));
  assert.deepEqual(stale, []);
});
