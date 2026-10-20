// Keeps every page on the type system: five sizes with their leadings, weight 400, tracking from
// the tokens, uppercase only for section labels, and spacing from the step scale.
// `node scripts/type-system.mjs` reports what breaks it; src/studies is outside the system.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Artwork sets its own letters inside a box that the grid places: no size, weight or tracking rule. */
export const ARTWORK = new Set([
  'src/components/catalogue/ProjectWordmark/ProjectWordmark.astro',
  'src/components/home/AboutSection/DecisionSign.astro',
]);

const SIZE = /^var\(--type-(label|body|heading|title|display|name)\)$/;
const LEADING = /^var\(--line-(label|label-block|body|heading|title|display|name)\)$/;
const TRACKING = /^(var\(--tracking-[a-z-]+\)|normal|inherit|0)$/;
const SPACING = /^(margin|padding|gap$|row-gap$|column-gap$)/;
const LENGTH = /-?\d*\.?\d+(px|rem|em)\b/;

/** Removes `var(...)` references, nested ones included, so only literal values remain. */
function withoutVars(value) {
  let previous;
  let result = value;
  do {
    previous = result;
    result = result.replace(/var\([^()]*\)/g, '');
  } while (result !== previous);
  return result;
}

/** Why one declaration breaks the system, or nothing when it follows it. */
function problem(path, property, value, comment) {
  const artwork = ARTWORK.has(path);
  if (property === 'font-size') return artwork || value === 'inherit' || SIZE.test(value);
  if (property === 'line-height') return value === 'inherit' || LEADING.test(value);
  if (property === 'font-weight') return artwork || value === '400' || value === 'inherit';
  if (property === 'letter-spacing') return artwork || TRACKING.test(value);
  if (property === 'text-transform')
    return value !== 'uppercase' || path === 'src/styles/global.css';
  if (SPACING.test(property))
    return comment.includes('optical') || !LENGTH.test(withoutVars(value));
  return true;
}

/** The stylesheet text of a file, with each line kept at its line number in the file. */
function styleLines(path, text) {
  const lines = text.split('\n');
  if (path.endsWith('.css')) return lines.map((line, index) => [index + 1, line]);
  const result = [];
  let inside = false;
  lines.forEach((line, index) => {
    if (/^\s*<\/style>/.test(line)) inside = false;
    if (inside) result.push([index + 1, line]);
    if (/^\s*<style[\s>]/.test(line)) inside = true;
  });
  return result;
}

/** One message per declaration that breaks the system, as `<line>: <property>: <value>`. */
export function checkTypeSystem(path, text) {
  const found = [];
  for (const [number, line] of styleLines(path, text.replace(/\r\n/g, '\n'))) {
    const match = /^\s*([a-z-]+)\s*:\s*([^;]*);(.*)$/.exec(line);
    if (!match) continue;
    const [, property, rawValue, rest] = match;
    const value = rawValue.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const comment = `${rawValue} ${rest}`;
    if (!problem(path, property, value, comment)) found.push(`${number}: ${property}: ${value}`);
  }
  return found;
}

function styleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'studies' ? [] : styleFiles(path);
    return /\.(astro|css)$/.test(entry.name) ? [path] : [];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const report = [];
  for (const file of styleFiles(join(root, 'src'))) {
    const path = relative(root, file).split(sep).join('/');
    const found = checkTypeSystem(path, readFileSync(file, 'utf8'));
    if (found.length) report.push(`${path}\n    ${found.join('\n    ')}`);
  }
  if (report.length) {
    console.error(`Off the type system:\n  ${report.join('\n  ')}`);
    process.exitCode = 1;
  } else {
    console.log('Type system followed.');
  }
}
