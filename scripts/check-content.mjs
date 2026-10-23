import { researchFigures } from '../src/data/research/figures.ts';
import { siteContent } from './site-content.mjs';
import { validateContent } from './validate-content.mjs';

const result = validateContent(siteContent, researchFigures);
console.log(
  `Verified content relationships: ${result.publications} publications, ${result.researchAreas} research areas, ${result.softwareEntries} software entries, and ${result.selectedWork} selected works.`,
);
