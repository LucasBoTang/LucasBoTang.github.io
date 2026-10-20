import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every file under `directory`, at any depth, whose name `matches`, leaving out the directories
 * named in `skip`.
 */
export function filesUnder(directory, matches = /./, skip = []) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      return skip.includes(entry.name) ? [] : filesUnder(path, matches, skip);
    return matches.test(entry.name) ? [path] : [];
  });
}
