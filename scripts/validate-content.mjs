import assert from 'node:assert/strict';
import { getPaperUrl } from '../src/data/publications.ts';
import { siteContentSchema } from '../src/data/schema.ts';

// Rules that span records. The shape of each record, including the form of its ID, is checked by
// the schema first.

function uniqueIds(records, label) {
  const ids = records.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, `Duplicate ${label} ID`);
}

export function validateContent(content) {
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
  }

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

  const destinations = contactLinks.map((link) => link.href);
  assert.equal(new Set(destinations).size, destinations.length, 'Duplicate contact destination');

  return {
    publications: records.length,
    researchAreas: researchAreas.length,
    softwareEntries: softwareEntries.length,
    selectedWork: selectedWork.length,
  };
}
