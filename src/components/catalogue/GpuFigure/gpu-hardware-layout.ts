type Point = readonly [number, number];

const REFLECTION_SCALE = 0.62;

// Source-image pixels. Recalibrate these faces when the platform artwork changes.
const dieFaces: readonly (readonly Point[])[] = [
  [
    [1092, 493],
    [1128, 471],
    [1169, 497],
    [1132, 520],
  ],
  [
    [793, 680],
    [835, 655],
    [874, 683],
    [833, 708],
  ],
];

export const gpuDieHighlights = dieFaces.map((face) => {
  const center = [0, 1].map(
    (axis) => face.reduce((sum, point) => sum + point[axis], 0) / face.length,
  );
  const reflection = face.map(([x, y]): Point => [
    Number((center[0] + (x - center[0]) * REFLECTION_SCALE).toFixed(2)),
    Number((center[1] + (y - center[1]) * REFLECTION_SCALE).toFixed(2)),
  ]);
  return { face, reflection };
});
