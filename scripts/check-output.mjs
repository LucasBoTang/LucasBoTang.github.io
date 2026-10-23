import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { openingParts } from '../src/components/home/opening/opening.ts';
import { theme } from '../src/data/theme.ts';
import { filesUnder } from './files.mjs';
import { siteContent } from './site-content.mjs';
import { pageFiles, pageOutputFile, validateOutput } from './validate-output.mjs';

const result = validateOutput(fileURLToPath(new URL('../dist/', import.meta.url)), siteContent);
console.log(
  `Verified ${result.pages} pages, ${result.localDestinations} local destinations, ${result.publications} publication records, and ${result.softwareEntries} software entries.`,
);

const readPage = (path) =>
  parseHTML(readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8')).document;
const home = readPage('index.html');
assert.equal(
  home.querySelector('h1').textContent.trim(),
  'Bo Tang',
  'Home name must retain its word separator',
);
const about = readPage('about/index.html');
for (const paragraph of about.querySelectorAll('.page-header p, .about-prose p')) {
  const text = paragraph.textContent.replace(/\s+/g, ' ').trim();
  assert.doesNotMatch(text, /\s[.,]/, `About text must not space before punctuation: ${text}`);
}
const missing = readPage('404.html');
assert.equal(missing.querySelector('meta[name="robots"]').content, 'noindex');
assert.equal(missing.querySelectorAll('[aria-current="page"]').length, 0);
for (const file of [...pageFiles, '404.html']) {
  const document = readPage(file);
  for (const p of document.querySelectorAll('.page-header p')) assert.ok(p.textContent.trim());
  assert.ok(document.querySelector('meta[property="og:site_name"]'));
  assert.equal(document.querySelector('meta[name="twitter:card"]').content, 'summary');
  assert.equal(document.querySelector('meta[name="theme-color"]').content, theme.ink);
  for (const [name, value] of Object.entries(theme)) {
    assert.equal(document.documentElement.style.getPropertyValue(`--${name}`).trim(), value);
  }
}
console.log(
  'Verified name spacing, About punctuation, page descriptions, social metadata and the 404 page.',
);

const favicon = readFileSync(new URL('../dist/favicon.svg', import.meta.url), 'utf8');
assert.ok(favicon.includes(`fill="${theme.ink}"`));
assert.ok(favicon.includes(`fill="${theme.blue}"`));
for (const description of home.querySelectorAll('.work-description')) {
  assert.doesNotMatch(
    description.textContent,
    /\b(?:MINLPs?|PDHG|LP)\b/,
    'Home highlights must spell out optimization terms',
  );
}

// Animation contracts: a missing marker would silently drop part of an opening.
for (const name of openingParts) {
  assert.ok(
    home.querySelector(`[data-opening-part="${name}"]`),
    `Home opening part missing: ${name}`,
  );
}
// Every page that asks SiteLayout for the reveal opening, found from its source.
const pagesDirectory = fileURLToPath(new URL('../src/pages/', import.meta.url));
const revealPages = filesUnder(pagesDirectory, /\.astro$/)
  .filter((file) => readFileSync(file, 'utf8').includes('opening="reveal"'))
  .map((file) => pageOutputFile(relative(pagesDirectory, file)));
assert.ok(revealPages.length > 0, 'No page uses the reveal opening');
for (const file of revealPages) {
  const root = readPage(file).querySelector('[data-reveal-root]');
  assert.ok(root, `${file}: reveal root missing`);
  assert.equal(
    root.querySelectorAll('[data-reveal="title"]').length,
    1,
    `${file}: one reveal title`,
  );
  assert.ok(root.querySelector('[data-reveal="unit"]'), `${file}: reveal units missing`);
}
console.log('Verified opening parts and reveal markers.');
