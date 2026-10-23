import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { theme } from '../src/data/theme.ts';
import { filesUnder } from './files.mjs';
import { siteContent } from './site-content.mjs';
import { pageOutputFile, readOutput, validateOutput } from './validate-output.mjs';
import { validateOpeningMarkers, validatePageMetadata } from './validate-page-contracts.mjs';

const output = readOutput(fileURLToPath(new URL('../dist/', import.meta.url)));
const result = validateOutput(output, siteContent);
console.log(
  `Verified ${result.pages} pages, ${result.localDestinations} local destinations, ${result.publications} publication records, and ${result.softwareEntries} software entries.`,
);

validatePageMetadata(output.documents);
console.log(
  'Verified name spacing, About punctuation, page descriptions, social metadata and the 404 page.',
);

const favicon = readFileSync(new URL('../dist/favicon.svg', import.meta.url), 'utf8');
assert.ok(favicon.includes(`fill="${theme.ink}"`));
assert.ok(favicon.includes(`fill="${theme.blue}"`));
const home = output.documents.get('index.html');
for (const description of home.querySelectorAll('.work-description')) {
  assert.doesNotMatch(
    description.textContent,
    /\b(?:MINLPs?|PDHG|LP)\b/,
    'Home highlights must spell out optimization terms',
  );
}

// Every page that asks SiteLayout for the reveal opening, found from its source.
const pagesDirectory = fileURLToPath(new URL('../src/pages/', import.meta.url));
const revealPages = filesUnder(pagesDirectory, /\.astro$/)
  .filter((file) => readFileSync(file, 'utf8').includes('opening="reveal"'))
  .map((file) => pageOutputFile(relative(pagesDirectory, file)));
validateOpeningMarkers(output.documents, revealPages);
console.log('Verified opening parts and reveal markers.');
