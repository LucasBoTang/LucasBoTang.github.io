// @ts-check
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Build-only cache version: changing an artwork invalidates remembered GPU warm-up.

/** Find sources from either this module or Astro's relocated prerender bundle. */
function catalogueRoot() {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const source = join(directory, 'src/components/catalogue');
    if (existsSync(source)) return source;
    const parent = dirname(directory);
    if (parent === directory) throw new Error('Cannot locate the research figure sources');
    directory = parent;
  }
}

const ROOT = catalogueRoot();
const SOURCES = ['GpuFigure', 'DflFigure', 'L2oFigure', 'FigureDocument.astro'];

/**
 * @param {string} path Source file or directory.
 * @returns {string[]} Files in stable traversal order.
 */
function files(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((entry) =>
        entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)],
      );
  } catch {
    return [path];
  }
}

const hash = createHash('sha256');
for (const file of SOURCES.flatMap((source) => files(join(ROOT, source)))) {
  hash.update(file.slice(ROOT.length).replaceAll('\\', '/'));
  hash.update(readFileSync(file));
}

/** Changes whenever any figure's source does. */
export const figureVersion = hash.digest('hex').slice(0, 12);
