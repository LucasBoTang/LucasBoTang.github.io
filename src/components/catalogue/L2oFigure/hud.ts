type Recording = {
  parameters: { b: number };
  steps: number[];
  corrected: number[][];
};
type Snapshot = {
  index: number;
  step: number;
  point: [number, number];
  status: 'Infeasible' | 'Feasible' | 'Integer feasible';
};

/** A HUD reading always belongs to one completed integer-correction result. */
export function createPredictionHud(recording: Recording): Snapshot[] {
  const b = recording.parameters.b;
  return recording.corrected.map(([x, y], index) => {
    const residual = Math.max(0, b / 2 - y, x * x - b, x, -y);
    const integral = Math.abs(y - Math.round(y)) <= 1e-6;
    return {
      index,
      step: recording.steps[index],
      point: [x, y],
      status: residual > 1e-6 ? 'Infeasible' : integral ? 'Integer feasible' : 'Feasible',
    };
  });
}

/** Keep the same object while processing the next checkpoint; never publish a partial pair. */
export function predictionHudAt(
  snapshots: Snapshot[],
  arrivals: number[],
  time: number,
  clearAt: number,
): Snapshot | null {
  if (time >= clearAt) return null;
  let result: Snapshot | null = null;
  for (let i = 0; i < snapshots.length; i++) if (time >= arrivals[i * 2 + 1]) result = snapshots[i];
  return result;
}
