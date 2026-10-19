import { formatVenueWithYear, getPaperUrl } from './publications.ts';
import type { SelectedWork } from './schema.ts';
import { projects, type SoftwareProject } from './software.ts';

export type { SelectedWork };

function selectWork(project: SoftwareProject, description: string): SelectedWork {
  return {
    title: project.publication.title,
    description,
    note: formatVenueWithYear(project.publication),
    href: getPaperUrl(project.publication),
    links: [project.code, ...(project.documentation ? [project.documentation] : [])],
    project,
  };
}

export const selectedWork: SelectedWork[] = [
  selectWork(
    projects.hPdlp,
    'Develops a generalized primal-dual hybrid gradient framework for a compact homogeneous self-dual formulation with linear convergence guarantees. Enables matrix-free GPU computation of linear programming solutions and infeasibility certificates.',
  ),
  selectWork(
    projects.reins,
    'Learns to solve parametric mixed-integer nonlinear programs without an optimization solver at inference time, using differentiable integer correction and feasibility projection with theoretical guarantees.',
  ),
  selectWork(
    projects.pyepo,
    'Introduces a unified framework and benchmarks for decision-focused learning, integrating linear and integer programming solvers with PyTorch and JAX training.',
  ),
];
