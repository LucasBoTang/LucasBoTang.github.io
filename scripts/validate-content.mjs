import assert from 'node:assert/strict';
import { getPublicationHref } from '../src/data/publications.ts';

function uniqueIds(records, label) {
  const ids = records.map(({ id }) => id);
  for (const id of ids) {
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid ${label} ID: ${id}`);
  }
  assert.equal(new Set(ids).size, ids.length, `Duplicate ${label} ID`);
}

function publicationHref(publication) {
  return getPublicationHref(publication);
}

export function validateContent(content) {
  const { publications, researchAreas, softwareGroups, selectedWork } = content;
  const records = Object.values(publications);
  const byId = new Map(records.map((publication) => [publication.id, publication]));
  const softwareEntries = softwareGroups.flatMap((group) => group.entries);
  const softwareProjects = softwareGroups
    .filter((group) => group.variant === 'primary')
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
      assert.ok(publication.review.journal.trim(), `${publication.id}: review journal is required`);
    }
  }

  assert.ok(
    researchAreas.some((area) => area.featured),
    'At least one featured research area is required for the home topics',
  );
  const occurrences = new Map(records.map(({ id }) => [id, 0]));
  for (const area of researchAreas) {
    for (const publication of area.publications) {
      assert.ok(
        publication && byId.has(publication.id),
        `${area.id}: canonical publication does not exist`,
      );
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

  for (const project of softwareProjects) {
    assert.ok(project.publication, `${project.id}: canonical publication is required`);
    assert.ok(
      byId.has(project.publication.id),
      `${project.id}: canonical publication does not exist`,
    );
    assert.equal(
      byId.get(project.publication?.id),
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
      project.links.some((link) => link.href === publicationHref(project.publication)),
      `${project.id}: related-paper link must reach its publication`,
    );
  }

  const selectedIds = new Set();
  for (const work of selectedWork) {
    assert.ok(
      softwareProjects.includes(work.project),
      `${work.title}: selected work must reference a primary project`,
    );
    assert.ok(!selectedIds.has(work.project.id), `${work.title}: duplicate selected work project`);
    selectedIds.add(work.project.id);
    assert.equal(
      work.href,
      publicationHref(work.project.publication),
      `${work.title}: selected work must link to its project's paper`,
    );
    for (const [label, resource] of [['Code', work.project.code]]) {
      assert.equal(
        work.links.find((link) => link.label === label)?.href,
        resource.href,
        `${work.title}: selected work ${label} must match its project`,
      );
    }
  }

  return {
    publications: records.length,
    researchAreas: researchAreas.length,
    softwareEntries: softwareEntries.length,
    selectedWork: selectedWork.length,
  };
}
