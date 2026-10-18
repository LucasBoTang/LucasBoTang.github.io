import { getPublicationHref, publications, type Publication } from './publications.ts';
import { projectResources, type ResourceLink } from './resources.ts';

export interface SoftwareEntry {
  id: string;
  name: string;
  role?: string;
  description: string;
  repository: string;
  links: ResourceLink[];
}

export interface SoftwareProject extends SoftwareEntry {
  role: string;
  publication: Publication;
  paper: ResourceLink;
  code: ResourceLink;
  documentation?: ResourceLink;
}

function createProject(project: Omit<SoftwareProject, 'repository' | 'links'>): SoftwareProject {
  return {
    ...project,
    repository: project.code.href,
    links: [
      project.code,
      ...(project.documentation ? [project.documentation] : []),
      { label: 'Related paper', href: getPublicationHref(project.publication) },
    ],
  };
}

export const primaryProjects = {
  pyepo: createProject({
    id: 'pyepo',
    name: 'PyEPO',
    role: 'Lead developer',
    description:
      'A unified framework for decision-focused learning with linear and integer optimization models, supporting PyTorch and JAX training.',
    publication: publications.pyepo,
    ...projectResources.pyepo,
  }),
  reins: createProject({
    id: 'reins',
    name: 'REINS',
    role: 'Lead developer',
    description:
      'A learning framework for parametric mixed-integer nonlinear optimization that requires no optimization solver at training and inference time.',
    publication: publications.learningMinlpFeasibility,
    ...projectResources.reins,
  }),
  hPdlp: createProject({
    id: 'h-pdlp',
    name: 'H-PDLP',
    role: 'Joint work with Haihao Lu',
    description:
      'A matrix-free GPU solver built on generalized PDHG and homogeneous self-dual embedding, unifying LP solving and infeasibility certification.',
    publication: publications.hPdlp,
    ...projectResources.hPdlp,
  }),
};

export const softwareProjects: SoftwareProject[] = Object.values(primaryProjects);

function createContribution(entry: Omit<SoftwareEntry, 'links'>): SoftwareEntry {
  return { ...entry, links: [{ label: 'Code', href: entry.repository }] };
}

// Upstream projects with verified contributions; descriptions introduce the software itself.
export const softwareContributions: SoftwareEntry[] = [
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

export type SoftwareVariant = 'primary' | 'contribution';

export interface SoftwareGroup {
  id: string;
  title: string;
  variant: SoftwareVariant;
  entries: SoftwareEntry[];
}

// The Software page renders these sections in order; validators check the same groups.
export const softwareGroups: SoftwareGroup[] = [
  { id: 'projects', title: 'Projects', variant: 'primary', entries: softwareProjects },
  {
    id: 'contributions',
    title: 'Contributions',
    variant: 'contribution',
    entries: softwareContributions,
  },
];
