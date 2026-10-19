// The shape of every content record, defined once. Data modules take their types from here,
// and `scripts/validate-content.mjs` checks the same records against these schemas at runtime.
import { z } from 'astro/zod';

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'IDs are lowercase words joined by hyphens');
const href = z
  .string()
  .regex(/^(?:https?:\/\/|mailto:|\/)/, 'Links are absolute URLs, mailto: addresses or site paths');
const text = z.string().trim().min(1);

const resourceLinkSchema = z.object({ label: text, href });

const publicationSchema = z.object({
  id,
  title: text,
  authors: z.array(text).min(1),
  venue: text,
  /** The year of publication, or of the first public version for a preprint. */
  year: z.number().int().min(1990).max(2100),
  status: z.enum(['Published', 'Preprint']),
  /** A review stage confirmed by the author; planned submissions are never recorded. */
  review: z
    .object({ status: z.enum(['Under review', 'Major revision']), journal: text })
    .optional(),
  links: z.array(resourceLinkSchema),
});

const researchAreaSchema = z.object({
  id,
  title: text,
  question: text,
  introduction: text,
  publications: z.array(publicationSchema),
  /** Featured areas appear as the research topics on the home page. */
  featured: z.boolean().optional(),
});

/** How ProjectWordmark draws a project's name. */
const wordmarkStyleSchema = z.object({
  /** Optical spacing for names whose letterforms run long or wide in Bodoni. */
  glyphs: z.enum(['long', 'wide']).optional(),
});

const softwareEntrySchema = z.object({
  id,
  name: text,
  role: text.optional(),
  description: text,
  repository: href,
  links: z.array(resourceLinkSchema),
});

const softwareProjectSchema = softwareEntrySchema.extend({
  role: text,
  wordmark: wordmarkStyleSchema,
  publication: publicationSchema,
  paper: resourceLinkSchema,
  code: resourceLinkSchema,
  documentation: resourceLinkSchema.optional(),
});

/** Projects are the author's own, with a paper and a wordmark; contributions are upstream work. */
const softwareGroupSchema = z.discriminatedUnion('variant', [
  z.object({
    id,
    title: text,
    variant: z.literal('project'),
    entries: z.array(softwareProjectSchema),
  }),
  z.object({
    id,
    title: text,
    variant: z.literal('contribution'),
    entries: z.array(softwareEntrySchema),
  }),
]);

const selectedWorkSchema = z.object({
  title: text,
  description: text,
  note: text,
  href,
  links: z.array(resourceLinkSchema),
  project: softwareProjectSchema,
});

const contactLinkSchema = z.object({
  /** Full name, used where links are written out. */
  service: text,
  /** Short label under the home page icon. */
  label: text,
  /** Accessible name for the icon when it should say more than `service`. */
  description: text.optional(),
  href,
  icon: z.enum(['email', 'scholar', 'github', 'linkedin']),
});

/** Everything the content checks receive; see `scripts/site-content.mjs`. */
export const siteContentSchema = z.object({
  publications: z.record(z.string(), publicationSchema),
  researchAreas: z.array(researchAreaSchema),
  softwareGroups: z.array(softwareGroupSchema),
  selectedWork: z.array(selectedWorkSchema),
  contactLinks: z.array(contactLinkSchema),
});

export type ResourceLink = z.infer<typeof resourceLinkSchema>;
export type Publication = z.infer<typeof publicationSchema>;
export type ResearchArea = z.infer<typeof researchAreaSchema>;
export type WordmarkStyle = z.infer<typeof wordmarkStyleSchema>;
export type SoftwareEntry = z.infer<typeof softwareEntrySchema>;
export type SoftwareProject = z.infer<typeof softwareProjectSchema>;
export type SoftwareGroup = z.infer<typeof softwareGroupSchema>;
export type SelectedWork = z.infer<typeof selectedWorkSchema>;
export type ContactLink = z.infer<typeof contactLinkSchema>;
