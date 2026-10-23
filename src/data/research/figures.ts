// Standalone artwork documents are lazy-loaded by their Research figure wrappers.
export const figurePaths = {
  gpu: '/figures/gpu-optimization/',
  dfl: '/figures/decision-focused-learning/',
  l2o: '/figures/learning-integers/',
} as const;

// Fixed desktop viewports preserve each composition when fitted into a home-page plate.
export const workPreviews = {
  'h-pdlp': {
    src: figurePaths.gpu,
    href: '/research/#bo-gpu-study',
    width: 716,
    height: 392,
    bleed: 64,
  },
  reins: {
    src: figurePaths.l2o,
    href: '/research/#bo-l2o-study',
    width: 588,
    height: 539,
    bleed: 0,
  },
  pyepo: {
    src: figurePaths.dfl,
    href: '/research/#bo-dfl-study',
    width: 652,
    height: 539,
    bleed: 32,
  },
} as const;
