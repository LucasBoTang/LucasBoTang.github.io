import assert from 'node:assert/strict';
import test from 'node:test';
import * as budget from '../../scripts/performance-budget.mjs';
import { checkMarkup, scriptsOf } from '../../scripts/performance-budget.mjs';
import { figurePaths } from '../../src/data/research/figures.ts';

const fonts = (count) =>
  Array.from(
    { length: count },
    (_, i) => `<link rel="preload" href="/_astro/f${i}.woff2" as="font" type="font/woff2">`,
  ).join('');
const idleExtended =
  '<link rel="prefetch" href="/_astro/geist-latin-ext.woff2" as="font" type="font/woff2">';
const preloadedExtended =
  '<link rel="preload" href="/_astro/geist-latin-ext.woff2" as="font" type="font/woff2">';

test('accepts a page that preloads its three fonts and draws at two decimals', () => {
  assert.deepEqual(
    checkMarkup('a.html', `${fonts(3)}${idleExtended}<path d="M0 1.25L3.5 4"/>`),
    [],
  );
});

test('flags a page that preloads too few fonts', () => {
  assert.match(checkMarkup('a.html', fonts(2) + idleExtended).join(), /preloads 2 fonts/);
});

test('flags drawing coordinates with more decimals than the eye can see', () => {
  assert.match(
    checkMarkup('a.html', `${fonts(3)}${idleExtended}<path d="M0 4.580749957775148Z"/>`).join(),
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

test('a page whose text needs the extended Latin letters preloads their font', () => {
  const names = '<p>Ján Drgo&#x148;a</p>';
  assert.match(checkMarkup('a.html', fonts(3) + idleExtended + names).join(), /has "ň"/);
  assert.deepEqual(checkMarkup('a.html', fonts(3) + preloadedExtended + names), []);
});

test('a page without them fetches that font only while idle', () => {
  assert.match(checkMarkup('a.html', fonts(3) + preloadedExtended).join(), /never needs/);
  assert.match(checkMarkup('a.html', fonts(3)).join(), /while idle/);
});

test('reads only the text a reader sees', () => {
  const html = '<style>.ň{}</style><script>"ň"</script><p title="ň">Bo</p>';
  assert.deepEqual(checkMarkup('a.html', fonts(3) + idleExtended + html), []);
});

test('lazy figure documents have their own enforced delivery budgets', () => {
  for (const route of Object.values(figurePaths)) {
    const file = `${route.slice(1)}index.html`;
    assert.ok(budget.budgetFiles?.includes(file), `Missing budget for ${file}`);
    const problems = budget.checkSize(file, 256, 256);
    assert.match(problems.join(), /HTML.*over/);
    assert.match(problems.join(), /scripts.*over/);
  }
});

test('standalone figures check drawing precision without the site font-preload contract', () => {
  const file = 'figures/gpu-optimization/index.html';
  assert.deepEqual(checkMarkup(file, '<path d="M0 1.25L3.5 4"/>'), []);
  assert.match(checkMarkup(file, '<path d="M0 1.23456"/>').join(), /too many decimals/);
});
