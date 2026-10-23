import assert from 'node:assert/strict';
import { getPaperUrl } from '../src/data/publications.ts';
import { researchFigureSchema, siteContentSchema } from '../src/data/schema.ts';

// Rules that span records. The shape of each record, including the form of its ID, is checked by
// the schema first.

function uniqueIds(records, label) {
  const ids = records.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, `Duplicate ${label} ID`);
}

/** A BibTeX entry must parse, name its source, and agree with the paper's own link. */
function checkBibtex(publication) {
  const { id, bibtex, status } = publication;
  let depth = 0;
  for (const character of bibtex) {
    depth += character === '{' ? 1 : character === '}' ? -1 : 0;
    assert.ok(depth >= 0, `${id}: BibTeX braces must balance`);
  }
  assert.equal(depth, 0, `${id}: BibTeX braces must balance`);
  // Each field holds one line: `  name = {value},`.
  const field = (name) => bibtex.match(new RegExp(`\\n  ${name} += \\{(.*)\\},?\\n`))?.[1];
  for (const name of ['title', 'author', 'year', 'doi'])
    assert.ok(field(name), `${id}: BibTeX needs a ${name}`);
  assert.equal(field('year'), String(publication.year), `${id}: BibTeX year`);
  const paper = getPaperUrl(publication);
  if (status === 'Preprint') {
    assert.ok(bibtex.startsWith('@misc{'), `${id}: a preprint's BibTeX is @misc`);
    const arxiv = field('howpublished')?.match(/^arXiv preprint arXiv:(\d{4}\.\d{4,5})$/)?.[1];
    assert.ok(arxiv, `${id}: a preprint's BibTeX names its arXiv number`);
    assert.equal(
      field('doi'),
      `10.48550/arXiv.${arxiv}`,
      `${id}: BibTeX DOI must be arXiv's for its number`,
    );
    if (paper.includes('arxiv.org/'))
      assert.ok(
        paper.endsWith(`/${arxiv}`),
        `${id}: BibTeX arXiv number must match the paper link`,
      );
  } else {
    assert.ok(!bibtex.startsWith('@misc{'), `${id}: a published paper's BibTeX names its venue`);
    assert.ok(
      decodeURIComponent(paper).toLowerCase().includes(field('doi').toLowerCase()),
      `${id}: BibTeX DOI must match the paper link`,
    );
  }
}

export function validateContent(content, figures = {}) {
  const parsed = siteContentSchema.safeParse(content);
  assert.ok(
    parsed.success,
    `Content does not match src/data/schema.ts:\n${parsed.error?.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')}`,
  );
  const { publications, researchAreas, softwareGroups, selectedWork, contactLinks } = content;
  const records = Object.values(publications);
  const byId = new Map(records.map((publication) => [publication.id, publication]));
  const softwareEntries = softwareGroups.flatMap((group) => group.entries);
  const projectEntries = softwareGroups
    .filter((group) => group.variant === 'project')
    .flatMap((group) => group.entries);
  uniqueIds(records, 'publication');
  uniqueIds(researchAreas, 'research area');
  uniqueIds(softwareGroups, 'software group');
  uniqueIds(softwareEntries, 'software');

  for (const publication of records) {
    if (publication.review) {
      assert.equal(
        publication.status,
        'Preprint',
        `${publication.id}: review metadata requires Preprint status`,
      );
    }
    checkBibtex(publication);
  }
  const bibtexKeys = records.map(({ bibtex }) => bibtex.match(/^@\w+\{([^,]+),/)[1]);
  assert.equal(new Set(bibtexKeys).size, bibtexKeys.length, 'Duplicate BibTeX key');

  assert.ok(
    researchAreas.some((area) => area.featured),
    'At least one featured research area is required for the home topics',
  );
  const occurrences = new Map(records.map(({ id }) => [id, 0]));
  for (const area of researchAreas) {
    for (const publication of area.publications) {
      assert.ok(byId.has(publication.id), `${area.id}: canonical publication does not exist`);
      assert.equal(
        byId.get(publication.id),
        publication,
        `${area.id}: use a canonical publication reference`,
      );
      occurrences.set(publication.id, occurrences.get(publication.id) + 1);
    }
  }
  for (const [id, count] of occurrences) {
    assert.equal(count, 1, `${id}: each publication must appear exactly once in Research`);
  }

  for (const project of projectEntries) {
    assert.ok(
      byId.has(project.publication.id),
      `${project.id}: canonical publication does not exist`,
    );
    assert.equal(
      byId.get(project.publication.id),
      project.publication,
      `${project.id}: use a canonical publication reference`,
    );
    assert.ok(
      project.publication.links.some((link) => link.href === project.paper.href),
      `${project.id}: paper resource must belong to the related publication`,
    );
    assert.equal(
      project.code.href,
      project.repository,
      `${project.id}: Code and repository must agree`,
    );
    assert.ok(
      project.links.some((link) => link.href === getPaperUrl(project.publication)),
      `${project.id}: related-paper link must reach its publication`,
    );
  }

  const selectedIds = new Set();
  for (const work of selectedWork) {
    assert.ok(
      projectEntries.includes(work.project),
      `${work.title}: selected work must reference a primary project`,
    );
    assert.ok(!selectedIds.has(work.project.id), `${work.title}: duplicate selected work project`);
    selectedIds.add(work.project.id);
    assert.equal(
      work.href,
      getPaperUrl(work.project.publication),
      `${work.title}: selected work must link to its project's paper`,
    );
    assert.equal(
      work.links.find((link) => link.label === 'Code')?.href,
      work.project.code.href,
      `${work.title}: selected work Code must match its project`,
    );
  }

  for (const figure of Object.values(figures)) {
    researchFigureSchema.parse(figure);
    assert.ok(
      researchAreas.some((area) => area.id === figure.area),
      `Unknown figure research area: ${figure.area}`,
    );
  }

  const destinations = contactLinks.map((link) => link.href);
  assert.equal(new Set(destinations).size, destinations.length, 'Duplicate contact destination');

  return {
    publications: records.length,
    researchAreas: researchAreas.length,
    softwareEntries: softwareEntries.length,
    selectedWork: selectedWork.length,
  };
}
