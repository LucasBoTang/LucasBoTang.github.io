// Keeps every built page within its weight: the HTML it parses, the scripts it loads, the fonts it
// fetches before the stylesheet asks, and drawing data with no more precision than the eye can
// see. `node scripts/performance-budget.mjs` checks dist/ after a build.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Kilobytes a page may weigh: its HTML, and the scripts it loads with everything they import. */
export const BUDGET = {
  'index.html': { html: 80, scripts: 60 },
  default: { html: 48, scripts: 24 },
};
/** Fonts every page fetches early: the serif, the mono and the sans of its first screen. */
export const PRELOADED_FONTS = 3;
/** Drawing coordinates carry at most this many decimals: a hundredth of a unit is already finer
 * than a pixel on every drawing on the site. */
export const COORDINATE_DECIMALS = 2;

/** Why the page's own markup breaks the budget, one message per problem. */
export function checkMarkup(file, html) {
  const problems = [];
  const fonts = html.match(/<link rel="preload"[^>]*as="font"[^>]*>/g) ?? [];
  if (fonts.length !== PRELOADED_FONTS)
    problems.push(`${file}: preloads ${fonts.length} fonts, not ${PRELOADED_FONTS}`);
  const precise = new RegExp(`\\d\\.\\d{${COORDINATE_DECIMALS + 1},}`);
  for (const [, path] of html.matchAll(/\sd="([^"]*)"/g)) {
    const number = path.match(precise);
    if (number) {
      problems.push(`${file}: a drawing coordinate carries too many decimals (${number[0]}…)`);
      break;
    }
  }
  return problems;
}

/** The scripts `html` loads, with every module they import, as paths under dist. */
export function scriptsOf(html, read) {
  const found = new Set(html.match(/(?<=src=")\/_astro\/[^"]+\.js(?=")/g) ?? []);
  for (const path of found)
    for (const [, name] of read(path).matchAll(/["']\.\/([^"']+\.js)["']/g))
      found.add(`/_astro/${name}`);
  return [...found];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = new URL('../dist/', import.meta.url);
  const read = (path) => readFileSync(new URL(`.${path}`, dist), 'utf8');
  const size = (path) => statSync(new URL(`.${path}`, dist)).size / 1024;
  const problems = [];
  const report = [];
  for (const file of [
    'index.html',
    'research/index.html',
    'software/index.html',
    'about/index.html',
  ]) {
    const html = read(`/${file}`);
    const budget = BUDGET[file] ?? BUDGET.default;
    const htmlSize = size(`/${file}`);
    const scriptSize = scriptsOf(html, read).reduce((total, path) => total + size(path), 0);
    if (htmlSize > budget.html)
      problems.push(`${file}: HTML is ${htmlSize.toFixed(0)}KB, over ${budget.html}KB`);
    if (scriptSize > budget.scripts)
      problems.push(`${file}: scripts are ${scriptSize.toFixed(0)}KB, over ${budget.scripts}KB`);
    problems.push(...checkMarkup(file, html));
    report.push(`${file} ${htmlSize.toFixed(0)}KB + ${scriptSize.toFixed(0)}KB scripts`);
  }
  if (problems.length) {
    console.error(`Over the performance budget:\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Within the performance budget: ${report.join(', ')}.`);
  }
}
