import assert from 'node:assert/strict';
import test from 'node:test';
import { formatVenue, formatVenueWithYear, getPaperUrl } from '../../src/data/publications.ts';
import { publicationsByYear, researchAreas } from '../../src/data/research.ts';

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
  assert.equal(getPaperUrl(published), 'https://example.invalid/paper');
});

test('shows the venue unless a confirmed review stage exists', () => {
  assert.equal(formatVenue(published), 'Example Journal');
  assert.equal(formatVenue(preprint), 'arXiv');
  assert.equal(formatVenue(underReview), 'Example Journal (Under review)');
});

test('summarizes a publication by venue, preprint year or review stage', () => {
  assert.equal(formatVenueWithYear(published), 'Example Journal, 2024');
  // A citation names where the paper is before the year: a preprint names its server.
  assert.equal(formatVenueWithYear(preprint), 'arXiv preprint, 2026');
  assert.equal(formatVenueWithYear(underReview), 'Example Journal (Under review)');
});

test('lists each theme newest first, keeping the written order for ties', () => {
  for (const area of researchAreas) {
    const years = publicationsByYear(area).map((publication) => publication.year);
    assert.deepEqual(
      years,
      [...years].sort((a, b) => b - a),
      area.id,
    );
  }
  const base = researchAreas[0].publications[0];
  const area = {
    ...researchAreas[0],
    publications: [
      { ...base, id: 'first', year: 2024 },
      { ...base, id: 'second', year: 2024 },
      { ...base, id: 'newer', year: 2025 },
    ],
  };
  assert.deepEqual(
    publicationsByYear(area).map(({ id }) => id),
    ['newer', 'first', 'second'],
  );
});
