import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { preloadModules } from '../../scripts/module-preload.mjs';

/** A built site in a temporary directory, removed after the test. */
function site(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'module-preload-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

test('a page preloads every module its entries import, however deep, once each', (t) => {
  const root = site(t, {
    'index.html':
      '<html><head><title>x</title></head><body>' +
      '<script type="module" src="/_astro/a.js"></script>' +
      '<script type="module" src="/_astro/b.js"></script></body></html>',
    '_astro/a.js': 'import{t}from"./shared.js";import"./effect.js";',
    '_astro/b.js': 'import{t}from"./shared.js";const later=()=>import("./lazy.js");',
    '_astro/shared.js': 'import{u}from"./deep.js";',
    '_astro/deep.js': 'export const u=1;',
    '_astro/effect.js': '',
    '_astro/lazy.js': '',
  });
  preloadModules(root, join(root, 'index.html'));
  const head = readFileSync(join(root, 'index.html'), 'utf8').split('</head>')[0];
  const preloaded = [...head.matchAll(/rel="modulepreload" href="([^"]+)"/g)].map(([, p]) => p);
  assert.deepEqual(preloaded.sort(), ['/_astro/deep.js', '/_astro/effect.js', '/_astro/shared.js']);
});

test('a page whose entries import nothing is left as it is', (t) => {
  const page = '<html><head></head><body><script type="module" src="/_astro/a.js"></script>';
  const root = site(t, { 'index.html': page, '_astro/a.js': 'console.log(1);' });
  preloadModules(root, join(root, 'index.html'));
  assert.equal(readFileSync(join(root, 'index.html'), 'utf8'), page);
});
