// Keeps every built page within its weight: the HTML it parses, the scripts it loads, the fonts it
// fetches before the stylesheet asks, and drawing data with no more precision than the eye can
// see. `node scripts/performance-budget.mjs` checks dist/ after a build.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { figurePaths } from '../src/data/research/figures.ts';
import { pageFiles } from './validate-output.mjs';

const figureFiles = Object.values(figurePaths).map((route) => `${route.slice(1)}index.html`);
/** Lazy documents still have their own network and parsing costs once shown. */
export const budgetFiles = [...pageFiles, ...figureFiles];

/** Kilobytes a page may weigh: its HTML, and the scripts it loads with everything they import. */
const BUDGET = {
  // Includes home previews and the sign's event-driven readiness; figures load only on intent,
  // but on a screen with hover the warm-up draws them ahead once the opening has settled.
  'index.html': { html: 80, scripts: 69 },
  // Includes four accessible theme lanes; their repeated visual lettering adds about 8KB.
  // Includes the phone lanes' shared entrance choreography and reading-index controller, and
  // the figures' warm-up, which draws each figure ahead once the opening has settled.
  'research/index.html': { html: 59, scripts: 29 },
  // Shared arrival queue reservations also ship with the software reading units.
  'software/index.html': { html: 48, scripts: 25 },
  // Artwork baselines (HTML/scripts): GPU 77/33KB after removing unused matrix frames,
  // DFL 8/25KB, L2O 23/28KB. Keep modest headroom without hiding a new data bundle.
  [`${figurePaths.gpu.slice(1)}index.html`]: { html: 80, scripts: 36 },
  [`${figurePaths.dfl.slice(1)}index.html`]: { html: 10, scripts: 28 },
  [`${figurePaths.l2o.slice(1)}index.html`]: { html: 26, scripts: 32 },
  default: { html: 48, scripts: 24 },
};
/** Fonts every page fetches early: the serif, the mono and the sans of its first screen. */
const PRELOADED_FONTS = 3;
/** Letters the extended Latin font set draws, after its unicode-range: text with any of them needs
 * that set from the start, and a page without them fetches it while idle instead. */
const EXTENDED_LETTERS = new RegExp(
  `[${[
    [0x100, 0x2ba],
    [0x1e00, 0x1eff],
    [0x2c60, 0x2c7f],
    [0xa720, 0xa7ff],
  ]
    .map(([from, to]) => `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`)
    .join('')}]`,
);
const EXTENDED_FONT = /latin-ext/;
/** Drawing coordinates carry at most this many decimals: a hundredth of a unit is already finer
 * than a pixel on every drawing on the site. */
const COORDINATE_DECIMALS = 2;

/** The text a reader sees in `html`: no tags, scripts or styles, and character references read. */
function textOf(html) {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)));
}

/** Why the page's own markup breaks the budget, one message per problem. */
export function checkMarkup(file, html) {
  const problems = [];
  // Embedded figures use cached site fonts but do not repeat the page preload contract.
  if (!figureFiles.includes(file)) {
    const fonts = html.match(/<link rel="preload"[^>]*as="font"[^>]*>/g) ?? [];
    const basic = fonts.filter((font) => !EXTENDED_FONT.test(font));
    if (basic.length !== PRELOADED_FONTS)
      problems.push(`${file}: preloads ${basic.length} fonts, not ${PRELOADED_FONTS}`);
    const letter = textOf(html).match(EXTENDED_LETTERS)?.[0];
    const preloadsExtended = fonts.some((font) => EXTENDED_FONT.test(font));
    if (letter && !preloadsExtended)
      problems.push(
        `${file}: its text has "${letter}", so it must preload the extended Latin font (add the page to extendedPages in SiteLayout.astro)`,
      );
    if (!letter && preloadsExtended)
      problems.push(
        `${file}: preloads the extended Latin font, which its text never needs (remove the page from extendedPages)`,
      );
    if (!letter && !/<link rel="prefetch"[^>]*latin-ext[^>]*>/.test(html))
      problems.push(`${file}: must fetch the extended Latin font while idle`);
  }
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

/** Check uncompressed kilobytes: parsing costs remain even with HTTP compression. */
export function checkSize(file, htmlSize, scriptSize) {
  const budget = BUDGET[file] ?? BUDGET.default;
  const problems = [];
  if (htmlSize > budget.html)
    problems.push(`${file}: HTML is ${htmlSize.toFixed(0)}KB, over ${budget.html}KB`);
  if (scriptSize > budget.scripts)
    problems.push(`${file}: scripts are ${scriptSize.toFixed(0)}KB, over ${budget.scripts}KB`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = new URL('../dist/', import.meta.url);
  const read = (path) => readFileSync(new URL(`.${path}`, dist), 'utf8');
  const size = (path) => statSync(new URL(`.${path}`, dist)).size / 1024;
  const problems = [];
  const report = [];
  for (const file of budgetFiles) {
    const html = read(`/${file}`);
    const htmlSize = size(`/${file}`);
    const scriptSize = scriptsOf(html, read).reduce((total, path) => total + size(path), 0);
    problems.push(...checkSize(file, htmlSize, scriptSize));
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
