import assert from 'node:assert/strict';
import test from 'node:test';
import { validateContent } from '../../scripts/validate-content.mjs';
import { contentFixture } from './fixtures.mjs';

test('accepts separate project and reproduction repositories without network access', () => {
  assert.doesNotThrow(() => validateContent(contentFixture()));
});

test('rejects records that do not match the content schema', () => {
  const content = contentFixture();
  content.publications.example.links = [{ label: 'Paper', href: 'example.invalid/paper' }];
  assert.throws(() => validateContent(content), /schema[\s\S]*links\.0\.href/i);
});

test('rejects duplicate canonical publication IDs', () => {
  const content = contentFixture();
  content.publications.duplicate = { ...content.publications.example };
  assert.throws(() => validateContent(content), /duplicate.*publication.*id/i);
});

test('requires every canonical publication to appear in exactly one research area', () => {
  for (const duplicate of [false, true]) {
    const content = contentFixture();
    content.researchAreas[0].publications = duplicate
      ? [content.publications.example, content.publications.example]
      : [];
    assert.throws(() => validateContent(content), /exactly once/i);
  }
});

test('rejects duplicate software IDs across groups', () => {
  const content = contentFixture();
  content.softwareGroups[1].entries[0].id = content.softwareGroups[0].entries[0].id;
  assert.throws(() => validateContent(content), /duplicate software id/i);
});

test('requires a featured research area for the home topics', () => {
  const content = contentFixture();
  content.researchAreas[0].featured = false;
  assert.throws(() => validateContent(content), /featured research area/i);
});

test('rejects review metadata retained after publication', () => {
  const content = contentFixture();
  content.publications.example.status = 'Published';
  assert.throws(() => validateContent(content), /review.*preprint/i);
});

test('rejects a software reference to an unknown publication', () => {
  const content = contentFixture();
  content.softwareGroups[0].entries[0].publication = {
    ...content.publications.example,
    id: 'unknown-paper',
  };
  assert.throws(() => validateContent(content), /canonical publication/i);
});

test('rejects highlights pointing to an unrelated paper or repository', () => {
  const wrongPaper = contentFixture();
  wrongPaper.selectedWork[0].href = '/research/#other-paper';
  assert.throws(() => validateContent(wrongPaper), /selected work.*paper/i);
  const wrongCode = contentFixture();
  wrongCode.selectedWork[0].links = [{ label: 'Code', href: 'https://example.invalid/unrelated' }];
  assert.throws(() => validateContent(wrongCode), /selected work.*code/i);
});

test('reports a missing project publication through the content schema', () => {
  const content = contentFixture();
  delete content.softwareGroups[0].entries[0].publication;
  assert.throws(() => validateContent(content), /schema[\s\S]*project\.publication/);
});

test('rejects two contact links to the same destination', () => {
  const content = contentFixture();
  content.contactLinks.push({ ...content.contactLinks[0], service: 'Mail', label: 'Mail' });
  assert.throws(() => validateContent(content), /duplicate contact destination/i);
});

test('checks each BibTeX entry against its paper', () => {
  const broken = [
    ['unbalanced braces', (bibtex) => bibtex.replace('{Example paper}', '{Example paper')],
    ['a year other than the paper', (bibtex) => bibtex.replace('{2026}', '{2025}')],
    ['a preprint without @misc', (bibtex) => bibtex.replace('@misc{', '@article{')],
    [
      'an arXiv DOI for another number',
      (bibtex) => bibtex.replace('2601.00001}\n}', '2601.00002}\n}'),
    ],
  ];
  for (const [label, edit] of broken) {
    const content = contentFixture();
    content.publications.example.bibtex = edit(content.publications.example.bibtex);
    assert.throws(() => validateContent(content), /BibTeX/, label);
  }
});

test("requires a published paper's BibTeX DOI to match its paper link", () => {
  const content = contentFixture();
  const publication = content.publications.example;
  delete publication.review;
  publication.status = 'Published';
  publication.bibtex = publication.bibtex
    .replace('@misc{', '@article{')
    .replace('10.48550/arXiv.2601.00001', '10.1000/example');
  assert.throws(() => validateContent(content), /DOI must match the paper link/);
});
