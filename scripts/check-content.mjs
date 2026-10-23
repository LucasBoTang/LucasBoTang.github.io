import { researchFigures } from '../src/data/research/figures.ts';
import { researchFigureSchema } from '../src/data/schema.ts';
import { siteContent } from './site-content.mjs';
import { validateContent } from './validate-content.mjs';

const result = validateContent(siteContent);
console.log(
  `Verified content relationships: ${result.publications} publications, ${result.researchAreas} research areas, ${result.softwareEntries} software entries, and ${result.selectedWork} selected works.`,
);

for (const figure of Object.values(researchFigures)) {
  researchFigureSchema.parse(figure);
  if (!siteContent.researchAreas.some((area) => area.id === figure.area))
    throw new Error(`Unknown figure research area: ${figure.area}`);
}
