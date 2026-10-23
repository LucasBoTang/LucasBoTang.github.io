import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Build-time only. A digest of every source file the figure documents are built from, so a
// visitor's record of the figures already drawn ahead (FigureWarmup) lapses when a figure changes:
// a redesigned figure may draw things whose GPU programs the browser has not yet compiled.

const ROOT = join(process.cwd(), 'src/components/catalogue');
const SOURCES = ['GpuFigure', 'DflFigure', 'L2oFigure', 'FigureDocument.astro'];

/** Every file under `path`, in a stable order. */
function files(path: string): string[] {
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
