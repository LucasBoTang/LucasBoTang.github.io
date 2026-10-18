import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { fileURLToPath } from 'node:url';
import { theme } from '../src/data/theme.ts';
import { siteContent } from './site-content.mjs';
import { validateOutput } from './validate-output.mjs';

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
const introduction = about.querySelector('.page-header p').textContent;
assert.equal(introduction, introduction.trim(), 'About intro must not have boundary whitespace');
assert.doesNotMatch(
  introduction,
  /\s+[.,]/,
  'About intro must not have whitespace before punctuation',
);
const missing = readPage('404.html');
assert.equal(missing.querySelector('meta[name="robots"]').content, 'noindex');
assert.equal(missing.querySelectorAll('[aria-current="page"]').length, 0);
for (const file of [
  'index.html',
  'about/index.html',
  'research/index.html',
  'software/index.html',
  '404.html',
]) {
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
