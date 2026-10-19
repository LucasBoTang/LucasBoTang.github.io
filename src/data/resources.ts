import type { ResourceLink } from './schema.ts';

export type { ResourceLink };

// Shared destinations for publications, the software catalogue, and home highlights.
export const projectResources = {
  pyepo: {
    paper: { label: 'Paper', href: 'https://link.springer.com/article/10.1007/s12532-024-00255-x' },
    code: { label: 'Code', href: 'https://github.com/khalil-research/PyEPO' },
    documentation: { label: 'Documentation', href: 'https://khalil-research.github.io/PyEPO/' },
  },
  reins: {
    paper: { label: 'Paper', href: 'https://arxiv.org/abs/2410.11061' },
    code: { label: 'Code', href: 'https://github.com/LucasBoTang/REINS' },
  },
  hPdlp: {
    paper: { label: 'Paper', href: 'https://arxiv.org/abs/2610.17695' },
    // Retained at the author's request ahead of the repository's public release.
    code: { label: 'Code', href: 'https://github.com/MIT-Lu-Lab/H-PDLP' },
  },
} satisfies Record<string, Record<string, ResourceLink>>;
