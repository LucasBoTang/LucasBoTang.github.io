// Shared fixtures: a small, valid site's content, and its built pages on disk.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

/** Content records for a one-paper, one-project site that passes every content check. */
export function contentFixture() {
  const paper = { label: 'Paper', href: 'https://example.invalid/paper' };
  const code = { label: 'Code', href: 'https://example.invalid/project' };
  const publication = {
    id: 'example-paper',
    title: 'Example paper',
    authors: ['Bo Tang'],
    venue: 'arXiv',
    year: 2026,
    status: 'Preprint',
    review: { status: 'Under review', journal: 'Example journal' },
    bibtex: [
      '@misc{tang2026example,',
      '  title        = {Example paper},',
      '  author       = {Tang, Bo},',
      '  howpublished = {arXiv preprint arXiv:2601.00001},',
      '  year         = {2026},',
      '  doi          = {10.48550/arXiv.2601.00001}',
      '}',
    ].join('\n'),
    links: [paper, { label: 'Code', href: 'https://example.invalid/reproduction' }],
  };
  const project = {
    id: 'example-project',
    name: 'Example',
    role: 'Primary developer',
    wordmark: { shape: 'stem' },
    description: 'Example software.',
    repository: code.href,
    publication,
    paper,
    code,
    links: [code, { label: 'Related paper', href: 'https://example.invalid/paper' }],
  };
  return {
    publications: { example: publication },
    researchAreas: [
      {
        id: 'example-area',
        title: 'Example area',
        question: 'An example question?',
        introduction: 'An example introduction.',
        publications: [publication],
        featured: true,
      },
    ],
    softwareGroups: [
      { id: 'projects', title: 'Projects', variant: 'project', entries: [project] },
      {
        id: 'contributions',
        title: 'Contributions',
        variant: 'contribution',
        entries: [
          {
            id: 'upstream',
            name: 'Upstream',
            description: 'An upstream library.',
            repository: 'https://example.invalid/upstream',
            links: [{ label: 'Code', href: 'https://example.invalid/upstream' }],
          },
        ],
      },
    ],
    contactLinks: [
      { service: 'Email', label: 'Email', href: 'mailto:someone@example.invalid', icon: 'email' },
    ],
    selectedWork: [
      {
        project,
        title: publication.title,
        description: 'Example highlight.',
        note: 'Example journal (Under review)',
        href: 'https://example.invalid/paper',
        links: [code],
      },
    ],
  };
}

/**
 * The built pages for `contentFixture()`, written to a temporary folder that is removed when the
 * test `t` ends. Returns the folder and the content.
 */
export function outputFixture(t) {
  const content = contentFixture();
  const root = mkdtempSync(join(tmpdir(), 'bo-tang-validation-'));
  t.after(() => {
    const absolute = resolve(root);
    assert.ok(absolute.startsWith(resolve(tmpdir()) + sep + 'bo-tang-validation-'));
    rmSync(absolute, { recursive: true, force: true });
  });
  const write = (file, value) => {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, value);
  };
  const page = (route, body) => `<!doctype html><html lang="en"><head>
    <title>Example</title><meta name="description" content="Example page">
    <link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/site.css">
    </head><body><header><a aria-current="page" href="${route}">Current page</a></header>
    <main id="main"><h1>Example</h1>${body}</main></body></html>`;
  write(
    'index.html',
    page(
      '/',
      `<ul class="research-topics"><li><a href="/research/#example-area">Example area</a></li></ul>
    <p class="work-title"><a href="https://example.invalid/paper">Example</a></p>
    <img alt="Example portrait" src="/assets/large.webp" srcset="/assets/small.webp 256w, /assets/large.webp 640w">`,
    ),
  );
  write(
    'research/index.html',
    page(
      '/research/',
      '<section id="example-area"><ul><li class="publication" id="example-paper">Example paper</li></ul></section>',
    ),
  );
  write(
    'software/index.html',
    page(
      '/software/',
      '<section id="projects"><article id="example-project"></article></section><section id="contributions"><article id="upstream"></article></section>',
    ),
  );
  write('about/index.html', page('/about/', '<p>Example biography.</p>'));
  write(
    'assets/site.css',
    '@font-face{font-family:Example;src:url("../fonts/example.woff2") format("woff2")}',
  );
  write('favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
  write('fonts/example.woff2', 'fixture font');
  write('assets/small.webp', 'fixture image');
  write('assets/large.webp', 'fixture image');
  return { root, content };
}
