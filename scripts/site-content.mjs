import { contactLinks } from '../src/data/profile.ts';
import { publications } from '../src/data/publications.ts';
import { researchAreas } from '../src/data/research.ts';
import { selectedWork } from '../src/data/selected-work.ts';
import { softwareGroups } from '../src/data/software.ts';
import { teaching } from '../src/data/teaching.ts';

// The same typed records Astro renders, assembled once for every check script.
export const siteContent = {
  publications,
  researchAreas,
  softwareGroups,
  selectedWork,
  contactLinks,
  teaching,
};
