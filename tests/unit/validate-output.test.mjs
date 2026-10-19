import assert from 'node:assert/strict';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { validateOutput } from '../../scripts/validate-output.mjs';
import { outputFixture } from './fixtures.mjs';

test('accepts valid static pages and their local asset graph', (t) => {
  const { root, content } = outputFixture(t);
  assert.doesNotThrow(() => validateOutput(root, content));
});

test('validates the About route and its current-page navigation', (t) => {
  const { root, content } = outputFixture(t);
  const file = join(root, 'about/index.html');
  const html = readFileSync(file, 'utf8');
  writeFileSync(file, html.replace('aria-current="page"', 'data-inactive="page"'));
  assert.throws(() => validateOutput(root, content), /current-page link/i);
  unlinkSync(file);
  assert.throws(() => validateOutput(root, content), /Missing page: about/i);
});

test('requires the home topics to match the featured research areas', (t) => {
  const { root, content } = outputFixture(t);
  content.researchAreas[0].featured = false;
  assert.throws(() => validateOutput(root, content), /featured research area/i);
});

test('rejects a canonical URL that points to another route', (t) => {
  const { root, content } = outputFixture(t);
  const file = join(root, 'research', 'index.html');
  writeFileSync(
    file,
    readFileSync(file, 'utf8').replace(
      '</head>',
      '<link rel="canonical" href="https://example.invalid/software/"></head>',
    ),
  );
  assert.throws(() => validateOutput(root, content), /canonical url must match/i);
});

test('detects missing responsive images, favicons, and CSS font resources', async (t) => {
  for (const missing of ['assets/small.webp', 'favicon.svg', 'fonts/example.woff2']) {
    await t.test(missing, (t) => {
      const { root, content } = outputFixture(t);
      unlinkSync(join(root, missing));
      assert.throws(() => validateOutput(root, content), /missing.*(asset|resource|file)/i);
    });
  }
});
