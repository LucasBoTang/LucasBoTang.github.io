import { getPaperUrl, publications } from './publications.ts';
import { projectResources } from './resources.ts';
import type { SoftwareEntry, SoftwareGroup, SoftwareProject, WordmarkStyle } from './schema.ts';

export type { SoftwareEntry, SoftwareGroup, SoftwareProject, WordmarkStyle };

function createProject(project: Omit<SoftwareProject, 'repository' | 'links'>): SoftwareProject {
  return {
    ...project,
    repository: project.code.href,
    links: [
      project.code,
      ...(project.documentation ? [project.documentation] : []),
      { label: 'Related paper', href: getPaperUrl(project.publication) },
    ],
  };
}

export const projects = {
  hPdlp: createProject({
    id: 'h-pdlp',
    name: 'H-PDLP',
    wordmark: { glyphs: 'long' },
    role: 'Joint work with Haihao Lu',
    description:
      'A matrix-free GPU solver for large-scale linear programming, computing optimal solutions or certificates of primal or dual infeasibility.',
    publication: publications.hPdlp,
    ...projectResources.hPdlp,
  }),
  reins: createProject({
    id: 'reins',
    name: 'REINS',
    role: 'Primary developer',
    wordmark: { glyphs: 'wide' },
    description:
      'A solver-free learning framework for parametric mixed-integer nonlinear optimization, efficiently producing feasible, high-quality solutions.',
    publication: publications.learningMinlpFeasibility,
    ...projectResources.reins,
  }),
  pyepo: createProject({
    id: 'pyepo',
    name: 'PyEPO',
    role: 'Primary developer',
    wordmark: {},
    description:
      'A unified framework for decision-focused learning with linear and integer optimization models, supporting PyTorch and JAX training.',
    publication: publications.pyepo,
    ...projectResources.pyepo,
  }),
};

const projectList: SoftwareProject[] = Object.values(projects);

function createContribution(entry: Omit<SoftwareEntry, 'links'>): SoftwareEntry {
  return { ...entry, links: [{ label: 'Code', href: entry.repository }] };
}

// Upstream projects with verified contributions; descriptions introduce the software itself.
const contributions: SoftwareEntry[] = [
  createContribution({
    id: 'cupdlpx',
    name: 'cuPDLPx',
    description: 'A GPU-accelerated linear programming solver.',
    repository: 'https://github.com/MIT-Lu-Lab/cuPDLPx',
  }),
  createContribution({
    id: 'pslp',
    name: 'PSLP',
    description: 'A C library for presolving linear programs.',
    repository: 'https://github.com/dance858/PSLP',
  }),
  createContribution({
    id: 'neuromancer',
    name: 'NeuroMANCER',
    description: 'A PyTorch library for differentiable optimization and control.',
    repository: 'https://github.com/pnnl/neuromancer',
  }),
  createContribution({
    id: 'fnnls',
    name: 'fnnls',
    description: 'A Python implementation of fast nonnegative least squares.',
    repository: 'https://github.com/jvendrow/fnnls',
  }),
];

// The Software page renders these sections in order; validators check the same groups.
export const softwareGroups: SoftwareGroup[] = [
  { id: 'projects', title: 'Projects', variant: 'project', entries: projectList },
  {
    id: 'contributions',
    title: 'Contributions',
    variant: 'contribution',
    entries: contributions,
  },
];
