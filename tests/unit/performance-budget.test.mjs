import assert from 'node:assert/strict';
import test from 'node:test';
import { checkMarkup, scriptsOf } from '../../scripts/performance-budget.mjs';

const fonts = (count) =>
  Array.from(
    { length: count },
    (_, i) => `<link rel="preload" href="/_astro/f${i}.woff2" as="font" type="font/woff2">`,
  ).join('');

test('accepts a page that preloads its three fonts and draws at two decimals', () => {
  assert.deepEqual(checkMarkup('a.html', `${fonts(3)}<path d="M0 1.25L3.5 4"/>`), []);
});

test('flags a page that preloads too few fonts', () => {
  assert.match(checkMarkup('a.html', fonts(2)).join(), /preloads 2 fonts/);
});

test('flags drawing coordinates with more decimals than the eye can see', () => {
  assert.match(
    checkMarkup('a.html', `${fonts(3)}<path d="M0 4.580749957775148Z"/>`).join(),
    /too many decimals/,
  );
});

test('counts the modules a script imports', () => {
  const files = {
    '/_astro/page.js': 'import{a}from"./shared.js";',
    '/_astro/shared.js': 'import"./deep.js";',
    '/_astro/deep.js': '',
  };
  const html = '<script type="module" src="/_astro/page.js"></script>';
  assert.deepEqual(scriptsOf(html, (path) => files[path]).sort(), [
    '/_astro/deep.js',
    '/_astro/page.js',
    '/_astro/shared.js',
  ]);
});
