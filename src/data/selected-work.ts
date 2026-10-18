import { formatPublicationSummary, getPublicationHref } from './publications.ts';
import type { ResourceLink } from './resources.ts';
import { primaryProjects, type SoftwareProject } from './software.ts';

export interface SelectedWork {
  title: string;
  description: string;
  note: string;
  href: string;
  links: ResourceLink[];
  project: SoftwareProject;
}

function selectWork(project: SoftwareProject, description: string): SelectedWork {
  return {
    title: project.publication.title,
    description,
    note: formatPublicationSummary(project.publication),
    href: getPublicationHref(project.publication),
    links: [project.code, ...(project.documentation ? [project.documentation] : [])],
    project,
  };
}

export const selectedWork: SelectedWork[] = [
  selectWork(
    primaryProjects.pyepo,
    'Introduces a unified framework and benchmarks for decision-focused learning, integrating linear and integer programming solvers with PyTorch and JAX training.',
  ),
  selectWork(
    primaryProjects.reins,
    'Learns to solve parametric mixed-integer nonlinear programs without an optimization solver at inference time, using differentiable integer correction and feasibility projection with theoretical guarantees.',
  ),
  selectWork(
    primaryProjects.hPdlp,
    'Develops a generalized primal-dual hybrid gradient framework for a compact homogeneous self-dual formulation with linear convergence guarantees. Enables matrix-free GPU computation of linear programming solutions and infeasibility certificates.',
  ),
];
