import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import test from 'node:test';
import { validateContent } from './validate-content.mjs';
import { validateOutput } from './validate-output.mjs';

function contentFixture() {
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
    links: [paper, { label: 'Code', href: 'https://example.invalid/reproduction' }],
  };
  const project = {
    id: 'example-project',
    name: 'Example',
    role: 'Lead developer',
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
      { id: 'projects', title: 'Projects', variant: 'primary', entries: [project] },
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
    selectedWork: [
      {
        project,
        title: publication.title,
        description: 'Example highlight.',
        note: 'Under review · Example journal',
        href: 'https://example.invalid/paper',
        links: [code],
      },
    ],
  };
}

test('accepts separate project and reproduction repositories without network access', () => {
  assert.doesNotThrow(() => validateContent(contentFixture()));
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

function outputFixture(t) {
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

test('reports a missing project publication before checking canonical identity', () => {
  const content = contentFixture();
  delete content.softwareGroups[0].entries[0].publication;
  assert.throws(() => validateContent(content), /canonical publication is required/);
});
