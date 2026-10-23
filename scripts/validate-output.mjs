import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parseHTML } from 'linkedom';
import { routes } from '../src/data/navigation.ts';
import { filesUnder } from './files.mjs';

const origin = 'https://preview.invalid';
/** The built file of every page in the site's routes, such as `research/index.html`. */
export const pageFiles = Object.values(routes).map((route) => `${route.slice(1)}index.html`);

/** Map a static Astro page source (relative to src/pages) to its generated HTML. */
export function pageOutputFile(source) {
  const path = source.replaceAll('\\', '/').replace(/\.astro$/, '');
  if (path === '404') return '404.html';
  return path === 'index' || path.endsWith('/index') ? `${path}.html` : `${path}/index.html`;
}

function sameRecords(actual, expected, message) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), message);
}

export function validateOutput(directory, content) {
  const output = resolve(directory);
  assert.ok(existsSync(output), 'Build output is missing; run npm run build first');
  const files = filesUnder(output).map((file) => relative(output, file).split(sep).join('/'));
  const documents = new Map(
    files
      .filter((file) => file.endsWith('.html'))
      .map((file) => [file, parseHTML(readFileSync(join(output, file), 'utf8')).document]),
  );
  for (const file of pageFiles) assert.ok(documents.has(file), `Missing page: ${file}`);
  let localDestinations = 0;

  function checkDestination(value, source) {
    assert.ok(value?.trim() && value.trim() !== '#', `${source}: real destination required`);
    const target = new URL(value, new URL(source, origin + '/'));
    assert.ok(
      ['https:', 'http:', 'mailto:', 'tel:', 'data:'].includes(target.protocol),
      `${source}: unsupported URL protocol ${target.protocol}`,
    );
    if (target.origin !== origin) return;
    let path = resolve(output, decodeURIComponent(target.pathname).slice(1));
    const localPath = relative(output, path);
    assert.ok(
      !isAbsolute(localPath) && localPath !== '..' && !localPath.startsWith('..' + sep),
      `${source}: local path leaves build output`,
    );
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    assert.ok(
      existsSync(path) && statSync(path).isFile(),
      `${source}: missing asset or file ${value}`,
    );
    const targetFile = relative(output, path).split(sep).join('/');
    if (target.hash && targetFile.endsWith('.html')) {
      assert.ok(
        documents.get(targetFile)?.getElementById(decodeURIComponent(target.hash.slice(1))),
        `${source}: missing anchor ${value}`,
      );
    }
    localDestinations++;
  }

  function checkCss(css, source) {
    for (const match of css.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/g)) {
      checkDestination(match[2] ?? match[3], source);
    }
  }

  for (const [file, document] of documents) {
    assert.equal(document.querySelectorAll('h1').length, 1, `${file}: one main heading required`);
    assert.equal(
      document.querySelectorAll('main').length,
      1,
      `${file}: one main landmark required`,
    );
    assert.ok(document.querySelector('html[lang="en"]'), `${file}: document language required`);
    assert.ok(document.querySelector('title')?.textContent.trim(), `${file}: page title required`);
    assert.ok(
      document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim(),
      `${file}: page description required`,
    );
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
    assert.ok(ids.every(Boolean), `${file}: empty element ID`);
    assert.equal(new Set(ids).size, ids.length, `${file}: unique element IDs required`);
    for (const element of document.querySelectorAll(
      'a[href], link[href], img[src], source[src], script[src]',
    )) {
      checkDestination(element.getAttribute('href') ?? element.getAttribute('src'), file);
    }
    for (const element of document.querySelectorAll('[srcset]')) {
      // Astro emits local image URL/width pairs separated by commas.
      for (const candidate of element.getAttribute('srcset').split(',')) {
        checkDestination(candidate.trim().split(/\s+/)[0], file);
      }
    }
    for (const image of document.querySelectorAll('img')) {
      assert.ok(image.hasAttribute('alt'), `${file}: image description required`);
    }
    for (const style of document.querySelectorAll('style')) checkCss(style.textContent, file);
    for (const element of document.querySelectorAll('[style]'))
      checkCss(element.getAttribute('style'), file);
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
    if (canonical) {
      assert.equal(
        new URL(canonical).pathname,
        '/' + file.replace(/index\.html$/, ''),
        `${file}: canonical URL must match its route`,
      );
    }
    if (pageFiles.includes(file)) {
      const current = document.querySelectorAll('a[aria-current="page"]');
      assert.equal(current.length, 1, `${file}: exactly one current-page link required`);
      assert.equal(
        new URL(current[0].getAttribute('href'), origin).pathname,
        '/' + file.replace(/index\.html$/, ''),
        `${file}: current-page navigation must match its route`,
      );
    }
  }
  for (const file of files.filter((file) => file.endsWith('.css'))) {
    checkCss(readFileSync(join(output, file), 'utf8'), file);
  }

  const { publications, researchAreas, softwareGroups, selectedWork } = content;
  const home = documents.get('index.html');
  const research = documents.get('research/index.html');
  sameRecords(
    [...research.querySelectorAll('li.publication')].map((item) => item.id),
    Object.values(publications).map(({ id }) => id),
    'Research must render every canonical publication exactly once',
  );
  for (const area of researchAreas) {
    const section = research.getElementById(area.id);
    assert.ok(section, `Research section missing: ${area.id}`);
    sameRecords(
      [...section.querySelectorAll('li.publication')].map((item) => item.id),
      area.publications.map(({ id }) => id),
      `${area.id}: publication grouping must match its data`,
    );
  }
  const software = documents.get('software/index.html');
  for (const group of softwareGroups) {
    const section = software.getElementById(group.id);
    assert.ok(section, `Software section missing: ${group.id}`);
    sameRecords(
      [...section.querySelectorAll('article')].map((item) => item.id),
      group.entries.map(({ id }) => id),
      `${group.id}: software entries must match their data`,
    );
  }
  sameRecords(
    [...home.querySelectorAll('.research-topics a')].map((link) => link.getAttribute('href')),
    researchAreas.filter((area) => area.featured).map((area) => `${routes.research}#${area.id}`),
    'Home must link every featured research area exactly once',
  );
  sameRecords(
    [...home.querySelectorAll('.work-title a')].map((link) => link.getAttribute('href')),
    selectedWork.map(({ href }) => href),
    'Home must render every selected work exactly once',
  );
  return {
    pages: documents.size,
    localDestinations,
    publications: Object.values(publications).length,
    softwareEntries: softwareGroups.reduce((count, group) => count + group.entries.length, 0),
  };
}
