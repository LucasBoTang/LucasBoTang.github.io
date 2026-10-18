import type { ImageMetadata } from 'astro';
import { routes } from './navigation.ts';
import { publications, type Publication } from './publications.ts';

export interface ResearchIllustration {
  /** An image imported from `src/assets/`, so the build can size and optimize it. */
  src: ImageMetadata;
  alt: string;
  caption?: string;
}

export interface ResearchArea {
  id: string;
  title: string;
  question: string;
  introduction: string;
  publications: Publication[];
  /** Featured areas appear as the research topics on the home page. */
  featured?: boolean;
  illustration?: ResearchIllustration;
}

export const researchAreas: ResearchArea[] = [
  {
    id: 'decision-focused-learning',
    title: 'Decision-focused learning',
    question: 'How should predictive models be trained for the decisions they inform?',
    introduction:
      'Decision-focused learning trains predictive models for decision quality rather than prediction accuracy alone. I developed PyEPO, a unified framework for end-to-end learning with optimization models. My work also introduces CaVE for faster decision-focused training with binary linear programs, and multi-task methods that learn across related decision problems.',
    publications: [
      publications.pyepo,
      publications.cave,
      publications.multiTaskPredictThenOptimize,
    ],
    featured: true,
  },
  {
    id: 'learning-to-optimize',
    title: 'Learning to optimize',
    question: 'How can learning make constrained optimization faster and more effective?',
    introduction:
      'Learning to optimize uses patterns across problems to accelerate optimization. My work spans learning to solve constrained problems directly and learning to guide classical algorithms. This includes solver-free methods for mixed-integer nonlinear optimization, and learned dual inequalities that stabilize and accelerate column generation.',
    publications: [publications.learningMinlpFeasibility, publications.learnedDualInequalities],
    featured: true,
  },
  {
    id: 'first-order-methods',
    title: 'GPU-accelerated optimization',
    question: 'How can optimization algorithms make full use of modern computing hardware?',
    introduction:
      'GPU-accelerated optimization rethinks algorithms to use parallel computing for larger problems and faster solutions. I develop first-order methods that bring linear programming and infeasibility detection into a unified GPU framework, with convergence guarantees that connect algorithm design to reliable computation.',
    publications: [publications.hPdlp],
    featured: true,
  },
  {
    id: 'other-research',
    title: 'Other research',
    question: 'How can optimization recover geometric structure from data?',
    introduction:
      'Recovering structure from data requires reasoning about both local variation and global geometry. My work brings these together through mixed-integer optimization, combining data fitting with explicit models of region connectivity and discontinuous boundaries in image segmentation and piecewise affine reconstruction.',
    publications: [publications.piecewiseAffineFitting, publications.mrfConnectivity],
  },
];

export const featuredResearchAreas: ResearchArea[] = researchAreas.filter((area) => area.featured);

export function getResearchAreaHref(area: ResearchArea): string {
  return `${routes.research}#${area.id}`;
}
