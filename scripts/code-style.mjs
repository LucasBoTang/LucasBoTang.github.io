// Enforces the import and CSS ordering rules that Prettier does not handle.
// `node scripts/code-style.mjs` reports problems; `--write` fixes them in place.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filesUnder } from './files.mjs';

// ------------------------------------------------------------------ imports
const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** 0 astro: · 1 packages · 2 stylesheets · 3 layouts · 4 components · 5 local modules · 6 assets */
function importGroup(source) {
  if (source.startsWith('node:')) return -1;
  if (source.startsWith('astro:') || source.startsWith('astro/')) return 0;
  if (!source.startsWith('.')) return 1;
  if (source.endsWith('.css')) return 2;
  if (source.includes('/layouts/')) return 3;
  if (source.endsWith('.astro')) return 4;
  if (/\.(jpe?g|png|webp|avif|svg|gif)$/.test(source)) return 6;
  return 5;
}

const IMPORT = /^import\s[^;]*?(?:from\s+)?'([^']+)';[^\n]*\n/gm;

/** Sorts the leading block of imports; local modules are alphabetical, everything else keeps its order. */
export function orderImports(code) {
  const prefix = /^(?:(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)+/.exec(code)?.[0] ?? '';
  if (prefix) return prefix + orderImports(code.slice(prefix.length));
  const block = /^(?:import\s[^;]*?;[^\n]*\n)+/.exec(code);
  if (!block) return code;
  const imports = [...block[0].matchAll(IMPORT)].map(([text, source]) => ({ text, source }));
  if (imports.map((i) => i.text).join('') !== block[0]) return code;
  const sorted = imports
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => {
      const group = importGroup(a.source) - importGroup(b.source);
      if (group) return group;
      if (importGroup(a.source) === 5) return compareText(a.source, b.source);
      return a.index - b.index;
    });
  const rest = code.slice(block[0].length).replace(/^\n*/, '');
  return sorted.map((i) => i.text).join('') + (rest ? '\n' + rest : '');
}

// ------------------------------------------------------- CSS declarations
const POSITION = new Set([
  'position',
  'z-index',
  'inset',
  'top',
  'right',
  'bottom',
  'left',
  'isolation',
]);
const LAYOUT = new Set(['display', 'order', 'float', 'gap', 'row-gap', 'column-gap']);
const BOX = new Set([
  'box-sizing',
  'width',
  'min-width',
  'max-width',
  'height',
  'min-height',
  'max-height',
  'aspect-ratio',
  'overflow',
  'overflow-x',
  'overflow-y',
  'object-fit',
  'object-position',
]);
const TYPE = new Set([
  'line-height',
  'letter-spacing',
  'white-space',
  'overflow-wrap',
  'vertical-align',
  'hyphens',
  'font-smoothing',
  'text-size-adjust',
  'tab-size',
]);
const PAINT = new Set([
  'color',
  'color-scheme',
  'opacity',
  'visibility',
  'box-shadow',
  'box-decoration-break',
  'clip-path',
  'filter',
  'mix-blend-mode',
]);

const unprefixed = (property) => property.replace(/^-(webkit|moz|ms)-/, '');

/** 0 custom · 1 content · 2 position · 3 layout · 4 box · 5 type · 6 paint · 7 motion · 8 other */
function declarationGroup(property) {
  const p = unprefixed(property);
  if (property.startsWith('--')) return 0;
  if (p === 'content') return 1;
  if (POSITION.has(p)) return 2;
  if (LAYOUT.has(p) || /^(flex|grid|align-|justify-|place-)/.test(p)) return 3;
  if (BOX.has(p) || /^(margin|padding|border|outline)/.test(p)) return 4;
  if (TYPE.has(p) || /^(font|text-|word-|list-style)/.test(p)) return 5;
  if (PAINT.has(p) || /^(background|fill|stroke|mask)/.test(p)) return 6;
  if (/^(transform|transition|animation|will-change)/.test(p)) return 7;
  return 8;
}

const SIDES = {
  inset: ['top', 'right', 'bottom', 'left'],
  gap: ['row-gap', 'column-gap'],
  'place-items': ['align-items', 'justify-items'],
  'place-content': ['align-content', 'justify-content'],
  'place-self': ['align-self', 'justify-self'],
};
for (const box of ['margin', 'padding']) {
  SIDES[`${box}-block`] = [`${box}-top`, `${box}-bottom`];
  SIDES[`${box}-inline`] = [`${box}-left`, `${box}-right`];
}

/** True when swapping the two declarations could change the cascade. */
function overlaps(a, b) {
  const [pa, pb] = [unprefixed(a.property), unprefixed(b.property)];
  if (pa === pb) return a.value !== b.value || a.property === b.property;
  const covers = (x, y) => y.startsWith(`${x}-`) || (SIDES[x] ?? []).includes(y);
  if (covers(pa, pb) || covers(pb, pa)) return true;
  return (SIDES[pa] ?? []).some((side) => (SIDES[pb] ?? []).includes(side));
}

function keepsOverlapOrder(original, ordered) {
  const position = new Map(ordered.map((entry, index) => [entry, index]));
  return original.every((a, i) =>
    original.slice(i + 1).every((b) => !overlaps(a, b) || position.get(a) < position.get(b)),
  );
}

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');

function orderBlock(body) {
  const lines = body.split('\n');
  if (lines.length < 3) return body;
  const [head, tail] = [lines[0], lines.at(-1)];
  const entries = [];
  let pending = [];
  for (const line of lines.slice(1, -1)) {
    pending.push(line);
    if (!stripComments(line).trim().endsWith(';')) continue;
    const declaration = stripComments(pending.join('\n')).trim();
    const colon = declaration.indexOf(':');
    entries.push({
      lines: pending,
      property: declaration.slice(0, colon).trim(),
      value: declaration
        .slice(colon + 1)
        .replace(/\s+/g, ' ')
        .trim(),
    });
    pending = [];
  }
  if (!entries.length || pending.some((line) => line.trim())) return body;
  if (entries.some((e) => e.property === 'syntax')) return body; // @property descriptors
  const byGroup = (a, b) => declarationGroup(a.property) - declarationGroup(b.property);
  const full = [...entries].sort(
    (a, b) =>
      byGroup(a, b) ||
      compareText(unprefixed(a.property), unprefixed(b.property)) ||
      Number(!a.property.startsWith('-')) - Number(!b.property.startsWith('-')),
  );
  const grouped = [...entries].sort(byGroup);
  const ordered = [full, grouped].find((o) => keepsOverlapOrder(entries, o)) ?? entries;
  return [head, ...ordered.flatMap((e) => e.lines), tail].join('\n');
}

export const orderDeclarations = (css) =>
  css.replace(/\{([^{}]*)\}/g, (_, body) => `{${orderBlock(body)}}`);

// ------------------------------------------------------------------ files
export function styleFile(path, text) {
  if (path.endsWith('.css')) return orderDeclarations(text);
  if (/\.(?:ts|mjs)$/.test(path)) return orderImports(text);
  let result = text.replace(/^---\n([\s\S]*?)\n---\n/, (_, frontmatter) => {
    const ordered = orderImports(`${frontmatter}\n`).replace(/\n$/, '');
    return `---\n${ordered}\n---\n`;
  });
  result = result.replace(/\n*(\n<style)/g, '\n$1');
  return result.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/g,
    (_, open, css, close) => open + orderDeclarations(css) + close,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const write = process.argv.includes('--write');
  const changed = [];
  const paths = [
    ...filesUnder(join(root, 'src'), /\.(astro|ts|css)$/),
    ...filesUnder(join(root, 'scripts'), /\.mjs$/),
    ...filesUnder(join(root, 'tests'), /\.(ts|mjs)$/),
    ...readdirSync(root)
      .filter((name) => /\.(ts|mjs)$/.test(name))
      .map((name) => join(root, name)),
  ];
  for (const path of paths) {
    const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
    const styled = styleFile(path, text);
    if (styled === text) continue;
    changed.push(relative(root, path).split(sep).join('/'));
    if (write) writeFileSync(path, styled);
  }
  if (write) {
    console.log(
      changed.length
        ? `Ordered ${changed.join(', ')}`
        : 'Import and CSS order already follow the rules.',
    );
  } else if (changed.length) {
    console.error(
      `Import or CSS order differs from the rules in:\n  ${changed.join('\n  ')}\nRun npm run format.`,
    );
    process.exitCode = 1;
  } else {
    console.log('Import and CSS order follow the rules.');
  }
}
