import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { readOutput } from '../../scripts/validate-output.mjs';
import {
  validateOpeningMarkers,
  validatePageMetadata,
} from '../../scripts/validate-page-contracts.mjs';
import { openingParts } from '../../src/components/home/opening/opening.ts';
import { theme } from '../../src/data/theme.ts';
import { outputFixture } from './fixtures.mjs';

function contractFixture(t) {
  const { root } = outputFixture(t);
  const { documents } = readOutput(root);
  documents.set(
    '404.html',
    parseHTML('<html><head><meta name="robots" content="noindex"></head><body></body></html>')
      .document,
  );
  for (const document of documents.values()) {
    document.head.innerHTML += `<meta property="og:site_name" content="Bo Tang">
      <meta name="twitter:card" content="summary">
      <meta name="theme-color" content="${theme.ink}">`;
    for (const [name, value] of Object.entries(theme))
      document.documentElement.style.setProperty(`--${name}`, value);
  }
  const home = documents.get('index.html');
  home.querySelector('h1').textContent = 'Bo Tang';
  home.querySelector('main').innerHTML += openingParts
    .map((name) => `<div data-opening-part="${name}"></div>`)
    .join('');
  const research = documents.get('research/index.html');
  research.querySelector('main').setAttribute('data-reveal-root', '');
  research.querySelector('h1').setAttribute('data-reveal', 'title');
  research.querySelector('section').setAttribute('data-reveal', 'unit');
  return documents;
}

test('page metadata and opening checks use the same parsed build documents', (t) => {
  const documents = contractFixture(t);
  assert.doesNotThrow(() => validatePageMetadata(documents));
  assert.doesNotThrow(() => validateOpeningMarkers(documents, ['research/index.html']));
});

test('site metadata checks retain copy, theme and unindexed 404 requirements', async (t) => {
  const cases = [
    ['index.html', (document) => (document.querySelector('h1').textContent = 'BoTang')],
    [
      'about/index.html',
      (document) => {
        document.querySelector('main').innerHTML += '<div class="about-prose"><p>Text .</p></div>';
      },
    ],
    [
      'software/index.html',
      (document) => document.documentElement.style.setProperty('--ink', 'incorrect'),
    ],
    [
      '404.html',
      (document) => document.querySelector('meta[name="robots"]').setAttribute('content', 'index'),
    ],
  ];
  for (const [file, invalidate] of cases) {
    await t.test(file, (t) => {
      const documents = contractFixture(t);
      invalidate(documents.get(file));
      assert.throws(() => validatePageMetadata(documents), assert.AssertionError);
    });
  }
});

test('opening checks reject absent home parts and incomplete reveal markup', async (t) => {
  await t.test('missing home part', (t) => {
    const documents = contractFixture(t);
    documents.get('index.html').querySelector('[data-opening-part]').remove();
    assert.throws(
      () => validateOpeningMarkers(documents, ['research/index.html']),
      /Home opening part missing/,
    );
  });
  for (const [selector, message] of [
    ['[data-reveal-root]', /reveal root missing/],
    ['[data-reveal="title"]', /one reveal title/],
    ['[data-reveal="unit"]', /reveal units missing/],
  ]) {
    await t.test(selector, (t) => {
      const documents = contractFixture(t);
      documents.get('research/index.html').querySelector(selector).remove();
      assert.throws(() => validateOpeningMarkers(documents, ['research/index.html']), message);
    });
  }
});
