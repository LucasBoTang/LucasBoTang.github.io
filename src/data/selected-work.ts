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
    'Develops a generalized primal-dual hybrid gradient method for a compact homogeneous self-dual embedding with linear convergence guarantees. Enables matrix-free GPU computation of solutions and infeasibility certificates for large-scale linear programs.',
  ),
  selectWork(
    projects.reins,
    'Learns to solve parametric mixed-integer nonlinear programs without an optimization solver at training and inference time, using differentiable integer correction and feasibility projection with theoretical guarantees. Produces feasible, high-quality solutions within milliseconds.',
  ),
  selectWork(
    projects.pyepo,
    'Introduces a unified framework and benchmarks integrating linear and integer programming solvers with PyTorch and JAX for decision-focused learning, which trains predictive models on the quality of the decisions they lead to rather than on prediction error alone.',
  ),
];
