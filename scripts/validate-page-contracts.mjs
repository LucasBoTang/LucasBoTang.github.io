import assert from 'node:assert/strict';
import { openingParts } from '../src/components/home/opening/opening.ts';
import { theme } from '../src/data/theme.ts';
import { pageFiles } from './validate-output.mjs';

/** Presentation requirements shared by the site shell and its route-specific copy. */
export function validatePageMetadata(documents) {
  const home = documents.get('index.html');
  assert.equal(
    home.querySelector('h1').textContent.trim(),
    'Bo Tang',
    'Home name must retain its word separator',
  );
  const about = documents.get('about/index.html');
  for (const paragraph of about.querySelectorAll('.page-header p, .about-prose p')) {
    const text = paragraph.textContent.replace(/\s+/g, ' ').trim();
    assert.doesNotMatch(text, /\s[.,]/, `About text must not space before punctuation: ${text}`);
  }
  const missing = documents.get('404.html');
  assert.equal(missing.querySelector('meta[name="robots"]').content, 'noindex');
  assert.equal(missing.querySelectorAll('[aria-current="page"]').length, 0);
  for (const file of [...pageFiles, '404.html']) {
    const document = documents.get(file);
    for (const p of document.querySelectorAll('.page-header p')) assert.ok(p.textContent.trim());
    assert.ok(document.querySelector('meta[property="og:site_name"]'));
    assert.equal(document.querySelector('meta[name="twitter:card"]').content, 'summary');
    assert.equal(document.querySelector('meta[name="theme-color"]').content, theme.ink);
    for (const [name, value] of Object.entries(theme)) {
      assert.equal(document.documentElement.style.getPropertyValue(`--${name}`).trim(), value);
    }
  }
}

/** A missing marker would silently drop part of a page's opening. */
export function validateOpeningMarkers(documents, revealPages) {
  const home = documents.get('index.html');
  for (const name of openingParts) {
    assert.ok(
      home.querySelector(`[data-opening-part="${name}"]`),
      `Home opening part missing: ${name}`,
    );
  }
  assert.ok(revealPages.length > 0, 'No page uses the reveal opening');
  for (const file of revealPages) {
    const root = documents.get(file).querySelector('[data-reveal-root]');
    assert.ok(root, `${file}: reveal root missing`);
    assert.equal(
      root.querySelectorAll('[data-reveal="title"]').length,
      1,
      `${file}: one reveal title`,
    );
    assert.ok(root.querySelector('[data-reveal="unit"]'), `${file}: reveal units missing`);
  }
}
