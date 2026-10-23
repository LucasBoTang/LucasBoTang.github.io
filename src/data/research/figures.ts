import { routes } from '../navigation.ts';
import type { ResearchFigure } from '../schema.ts';

export const gpuConvergenceData = '/data/research/rail4284-convergence.json';

/** One record per artwork: composition, fitting, home preview, copy and provenance.
 * Build-time consumers emit only the fields needed by each document. */
export const researchFigures = {
  gpu: {
    src: '/figures/gpu-optimization/',
    project: 'h-pdlp',
    canvas: { width: 716, height: 539, bleed: 64 },
    fitting: { compactAt: 480, compactCanvas: null },
    area: 'first-order-methods',
    anchor: 'bo-gpu-study',
    title: 'Large-scale optimization with GPUs',
    captionId: 'gpu-context-caption',
    caption: 'Scaling optimization with GPU-accelerated sparse linear algebra.',
    summary: 'Figure details & credits',
    details: [
      [
        'The real rail4284 standard-form matrix has 4,284 rows, 1,096,894 columns and 11,284,032 nonzeros. It is a set-covering problem from Italian railways, contributed by Paolo Nobili to ',
        {
          label: 'Beasley’s OR-Library',
          href: 'https://people.brunel.ac.uk/~mastjjb/jeb/orlib/scpinfo.html',
        },
        ' .',
      ],
      [
        'Convergence shows the relative primal residual, dual residual and objective gap from an H-PDLP run to 10⁻⁴. Matrix-product motion is illustrative. ',
        {
          label: 'Run data & provenance',
          href: gpuConvergenceData,
        },
        '.',
      ],
      [
        'Photo: ',
        {
          label: 'Pi.1415926535 / Wikimedia Commons',
          href: 'https://commons.wikimedia.org/wiki/File:Aerial_view_of_West_Oakland_rail_yards,_December_2022.JPG',
        },
        ' , under the ',
        {
          label: 'CC BY-SA 4.0',
          href: 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
        ', cropped and color-adjusted; the photographic adaptation remains CC BY-SA 4.0. The yard is illustrative, not the source location of rail4284.',
      ],
    ],
  },
  l2o: {
    src: '/figures/learning-integers/',
    project: 'reins',
    canvas: { width: 588, height: 539, bleed: 0 },
    fitting: { compactAt: 420, compactCanvas: { width: 330, height: 818, bleed: 0 } },
    area: 'learning-to-optimize',
    anchor: 'bo-l2o-study',
    title: 'Learning to generate integer solutions: recorded relaxed and integer predictions',
    captionId: 'l2o-caption',
    caption: 'Training a solution map with differentiable integer correction.',
    summary: 'Figure details',
    details: [
      [
        'Training predictions from a rerun of the ',
        {
          label: 'L2O-MINLP Rosenbrock example',
          href: 'https://github.com/pnnl/L2O-MINLP/blob/6dd2a901144ae9892cf545a88f54fe60caef9ebe/test/Training%20Iterations%20for%20Rosenbrock.ipynb',
        },
        ' . Surface height is log(1 + f).',
      ],
    ],
  },
  dfl: {
    src: '/figures/decision-focused-learning/',
    project: 'pyepo',
    canvas: { width: 652, height: 539, bleed: 32 },
    fitting: { compactAt: 420, compactCanvas: null },
    area: 'decision-focused-learning',
    anchor: 'bo-dfl-study',
    title: 'Learning for better decisions',
    captionId: 'dfl-caption',
    caption: 'Train predictions for the decisions they inform.',
    summary: 'Figure details & credits',
    details: [
      [
        'Predictions are trained through downstream decision quality. Based on ',
        {
          label: 'PyEPO, Section 3',
          href: 'https://arxiv.org/html/2206.14234v3#S3',
        },
        '.',
      ],
      [
        'Photo: ',
        {
          label: 'Mikhail Nilov / Pexels',
          href: 'https://www.pexels.com/photo/a-person-using-a-calculator-8297018/',
        },
        ' . Cropped and color-adjusted.',
      ],
    ],
  },
} satisfies Record<string, ResearchFigure>;

export type FigureKind = keyof typeof researchFigures;

// Build-time route and preview indexes are derived, never maintained in parallel.
export const figurePaths = Object.fromEntries(
  Object.entries(researchFigures).map(([kind, figure]) => [kind, figure.src]),
) as Record<FigureKind, string>;

export const workPreviews = Object.fromEntries(
  Object.values(researchFigures).map((figure) => [
    figure.project,
    {
      src: figure.src,
      href: `${routes.research}#${figure.anchor}`,
      ...figure.canvas,
    },
  ]),
);
