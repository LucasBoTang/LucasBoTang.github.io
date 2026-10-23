import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

// A built page names only its entry scripts, so a browser learns of the shared modules they import
// only once each entry has arrived, then of theirs once those have: one round trip per level.
// From a host 300ms away that alone delays every script, and a first visit's figure warm-up, by
// a second. After the build, each page's head lists every module its entries import, however
// deep, as `modulepreload`, so all of them are requested with the page.

const ENTRY = /<script type="module" src="(\/[^"]+\.js)"/g;
const IMPORT = /(?:\bfrom|\bimport)\s*"(\.{1,2}\/[^"]+\.js)"/g;

/** Every module `entry` imports statically, however deep, by site path. */
function importsOf(root, entry, found = new Set()) {
  for (const [, specifier] of readFileSync(join(root, entry), 'utf8').matchAll(IMPORT)) {
    const path = posix.join(posix.dirname(entry), specifier);
    if (found.has(path)) continue;
    found.add(path);
    importsOf(root, path, found);
  }
  return found;
}

/** Adds `modulepreload` links for its entries' imports to one built page. */
export function preloadModules(root, file) {
  const html = readFileSync(file, 'utf8');
  const entries = [...html.matchAll(ENTRY)].map(([, src]) => src);
  const modules = new Set(entries.flatMap((entry) => [...importsOf(root, entry)]));
  for (const entry of entries) modules.delete(entry);
  if (!modules.size || !html.includes('</head>')) return;
  const links = [...modules].map((path) => `<link rel="modulepreload" href="${path}">`).join('');
  writeFileSync(file, html.replace('</head>', `${links}</head>`));
}

function pages(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

/** The Astro integration: preload every page's imported modules once the build is written. */
export default function modulePreload() {
  return {
    name: 'module-preload',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const root = fileURLToPath(dir);
        for (const file of pages(root)) preloadModules(root, file);
      },
    },
  };
}
