import { projectResources } from './resources.ts';
import type { Publication } from './schema.ts';

export type { Publication };

// Keep published titles and author order aligned with the publication record.
// Preprint years refer to the first public version. Review stages come from the author-supplied CV; planned submissions are omitted.
// Each BibTeX entry follows the publisher's record (Crossref, and Springer for series volumes) or
// arXiv's: journal and proceedings papers give their DOI, preprints are `@misc` with arXiv's DOI,
// and braces keep acronyms and names in their case.
export const publications = {
  pyepo: {
    id: 'pyepo',
    title:
      'PyEPO: A PyTorch-based End-to-End Predict-then-Optimize Library for Linear and Integer Programming',
    authors: ['Bo Tang', 'Elias B. Khalil'],
    venue: 'Mathematical Programming Computation',
    year: 2024,
    status: 'Published',
    bibtex: String.raw`@article{tang2024pyepo,
  title     = {{PyEPO}: A {PyTorch}-based end-to-end predict-then-optimize library for linear and integer programming},
  author    = {Tang, Bo and Khalil, Elias B.},
  journal   = {Mathematical Programming Computation},
  volume    = {16},
  number    = {3},
  pages     = {297--335},
  year      = {2024},
  doi       = {10.1007/s12532-024-00255-x},
  publisher = {Springer}
}`,
    links: [projectResources.pyepo.paper, projectResources.pyepo.code],
  },
  cave: {
    id: 'cave',
    title:
      'CaVE: A Cone-Aligned Approach for Fast Predict-then-Optimize with Binary Linear Programs',
    authors: ['Bo Tang', 'Elias B. Khalil'],
    venue: 'CPAIOR',
    year: 2024,
    status: 'Published',
    bibtex: String.raw`@inproceedings{tang2024cave,
  title     = {{CaVE}: A Cone-Aligned Approach for Fast Predict-then-optimize with Binary Linear Programs},
  author    = {Tang, Bo and Khalil, Elias B.},
  booktitle = {Integration of Constraint Programming, Artificial Intelligence, and Operations Research},
  editor    = {Dilkina, Bistra},
  series    = {Lecture Notes in Computer Science},
  volume    = {14743},
  pages     = {193--210},
  year      = {2024},
  doi       = {10.1007/978-3-031-60599-4_12},
  publisher = {Springer},
  address   = {Cham}
}`,
    links: [
      {
        label: 'Paper',
        href: 'https://link.springer.com/chapter/10.1007/978-3-031-60599-4_12',
      },
      { label: 'Code', href: 'https://github.com/khalil-research/CaVE' },
    ],
  },
  multiTaskPredictThenOptimize: {
    id: 'multi-task-predict-then-optimize',
    title: 'Multi-Task Predict-then-Optimize',
    authors: ['Bo Tang', 'Elias B. Khalil'],
    venue: 'Learning and Intelligent Optimization (LION)',
    year: 2023,
    status: 'Published',
    bibtex: String.raw`@inproceedings{tang2023multi,
  title     = {Multi-task Predict-then-Optimize},
  author    = {Tang, Bo and Khalil, Elias B.},
  booktitle = {Learning and Intelligent Optimization},
  editor    = {Sellmann, Meinolf and Tierney, Kevin},
  series    = {Lecture Notes in Computer Science},
  volume    = {14286},
  pages     = {506--522},
  year      = {2023},
  doi       = {10.1007/978-3-031-44505-7_34},
  publisher = {Springer},
  address   = {Cham}
}`,
    links: [
      {
        label: 'Paper',
        href: 'https://link.springer.com/chapter/10.1007/978-3-031-44505-7_34',
      },
      {
        label: 'Code',
        href: 'https://github.com/khalil-research/Multi-Task_Predict-then-Optimize',
      },
    ],
  },
  learningMinlpFeasibility: {
    id: 'learning-minlp-feasibility',
    title:
      'Learning to Optimize for Mixed-Integer Non-linear Programming with Feasibility Guarantees',
    authors: ['Bo Tang', 'Elias B. Khalil', 'Ján Drgoňa'],
    venue: 'arXiv',
    year: 2024,
    status: 'Preprint',
    review: { status: 'Major revision', journal: 'INFORMS Journal on Computing' },
    bibtex: String.raw`@misc{tang2024learning,
  title        = {Learning to Optimize for Mixed-Integer Non-linear Programming with Feasibility Guarantees},
  author       = {Tang, Bo and Khalil, Elias B. and Drgo{\v{n}}a, J{\'a}n},
  howpublished = {arXiv preprint arXiv:2410.11061},
  year         = {2024},
  doi          = {10.48550/arXiv.2410.11061}
}`,
    links: [
      projectResources.reins.paper,
      // The paper's implementation and the REINS software project use separate repositories.
      { label: 'Code', href: 'https://github.com/pnnl/L2O-MINLP' },
    ],
  },
  learnedDualInequalities: {
    id: 'learned-dual-inequalities',
    title: 'Learned Pairwise Deep Dual-Optimal Inequalities for Stabilizing Column Generation',
    authors: ['Zhengzhong Ricky You', 'Bo Tang', 'Haoran Liu', 'Baichuan Mo'],
    venue: 'arXiv',
    year: 2026,
    status: 'Preprint',
    review: { status: 'Under review', journal: 'INFORMS Journal on Computing' },
    bibtex: String.raw`@misc{you2026learned,
  title        = {Learned Pairwise Deep Dual-Optimal Inequalities for Stabilizing Column Generation},
  author       = {You, Zhengzhong Ricky and Tang, Bo and Liu, Haoran and Mo, Baichuan},
  howpublished = {arXiv preprint arXiv:2607.13373},
  year         = {2026},
  doi          = {10.48550/arXiv.2607.13373}
}`,
    links: [{ label: 'Paper', href: 'https://arxiv.org/abs/2607.13373' }],
  },
  hPdlp: {
    id: 'h-pdlp',
    title:
      'H-PDLP: GPU-Accelerated Linear Programming via Generalized PDHG and Homogeneous Self-Dual Embedding',
    authors: ['Haihao Lu', 'Bo Tang'],
    venue: 'arXiv',
    year: 2026,
    status: 'Preprint',
    bibtex: String.raw`@misc{lu2026hpdlp,
  title        = {{H-PDLP}: {GPU}-Accelerated Linear Programming via Generalized {PDHG} and Homogeneous Self-Dual Embedding},
  author       = {Lu, Haihao and Tang, Bo},
  howpublished = {arXiv preprint arXiv:2610.17695},
  year         = {2026},
  doi          = {10.48550/arXiv.2610.17695}
}`,
    links: [projectResources.hPdlp.paper, projectResources.hPdlp.code],
  },
  piecewiseAffineFitting: {
    id: 'piecewise-affine-fitting',
    title:
      'Learning discontinuous piecewise affine fitting functions using mixed integer programming over lattice',
    authors: ['Ruobing Shen', 'Bo Tang', 'Leo Liberti', 'Claudia D’Ambrosio', 'Stéphane Canu'],
    venue: 'Journal of Global Optimization',
    year: 2021,
    status: 'Published',
    bibtex: String.raw`@article{shen2021learning,
  title     = {Learning discontinuous piecewise affine fitting functions using mixed integer programming over lattice},
  author    = {Shen, Ruobing and Tang, Bo and Liberti, Leo and D'Ambrosio, Claudia and Canu, St{\'e}phane},
  journal   = {Journal of Global Optimization},
  volume    = {81},
  number    = {1},
  pages     = {85--108},
  year      = {2021},
  doi       = {10.1007/s10898-021-01034-x},
  publisher = {Springer}
}`,
    links: [
      { label: 'Paper', href: 'https://link.springer.com/article/10.1007/s10898-021-01034-x' },
      { label: 'Code', href: 'https://github.com/LucasBoTang/Piecewise_Affine_Fitting' },
    ],
  },
  mrfConnectivity: {
    id: 'mrf-connectivity',
    title: 'An ILP Model for Multi-Label MRFs With Connectivity Constraints',
    authors: ['Ruobing Shen', 'Bo Tang', 'Andrea Lodi', 'Andrea Tramontani', 'Ismail Ben Ayed'],
    venue: 'IEEE Transactions on Image Processing',
    year: 2020,
    status: 'Published',
    bibtex: String.raw`@article{shen2020ilp,
  title     = {An {ILP} Model for Multi-Label {MRFs} With Connectivity Constraints},
  author    = {Shen, Ruobing and Tang, Bo and Lodi, Andrea and Tramontani, Andrea and Ben Ayed, Ismail},
  journal   = {IEEE Transactions on Image Processing},
  volume    = {29},
  pages     = {6909--6917},
  year      = {2020},
  doi       = {10.1109/TIP.2020.2995056},
  publisher = {IEEE}
}`,
    links: [{ label: 'Paper', href: 'https://doi.org/10.1109/TIP.2020.2995056' }],
  },
} satisfies Record<string, Publication>;

/** The paper's own page, from its `Paper` link. */
export function getPaperUrl(publication: Publication): string {
  const paper = publication.links.find((link) => link.label === 'Paper');
  if (!paper) throw new Error(`Missing paper link: ${publication.id}`);
  return paper.href;
}

/** Where the paper appeared, or its confirmed review stage. */
export function formatVenue(publication: Publication): string {
  return publication.review
    ? `${publication.review.journal} (${publication.review.status})`
    : publication.venue;
}

/** As `formatVenue`, with the year for published papers and preprints. */
export function formatVenueWithYear(publication: Publication): string {
  if (publication.review) {
    return formatVenue(publication);
  }
  return publication.status === 'Published'
    ? `${publication.venue}, ${publication.year}`
    : `${publication.venue} preprint, ${publication.year}`;
}
