import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatPublicationMetadata,
  formatPublicationSummary,
  getPublicationHref,
} from '../src/data/publications.ts';

const published = {
  id: 'example-paper',
  title: 'Example paper',
  authors: ['Bo Tang'],
  venue: 'Example Journal',
  year: 2024,
  status: 'Published',
  links: [{ label: 'Paper', href: 'https://example.invalid/paper' }],
};
const preprint = { ...published, venue: 'arXiv', year: 2026, status: 'Preprint' };
const underReview = { ...preprint, review: { status: 'Under review', journal: 'Example Journal' } };

test('links publication titles directly to papers', () => {
  assert.equal(getPublicationHref(published), 'https://example.invalid/paper');
});

test('shows the venue unless a confirmed review stage exists', () => {
  assert.equal(formatPublicationMetadata(published), 'Example Journal');
  assert.equal(formatPublicationMetadata(preprint), 'arXiv');
  assert.equal(formatPublicationMetadata(underReview), 'Example Journal (Under review)');
});

test('summarizes a publication by venue, preprint year or review stage', () => {
  assert.equal(formatPublicationSummary(published), 'Example Journal, 2024');
  assert.equal(formatPublicationSummary(preprint), 'Preprint, 2026');
  assert.equal(formatPublicationSummary(underReview), 'Example Journal (Under review)');
});
