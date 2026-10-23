import type { trainingBeat } from './timing';

/** Shared surface-to-instrument clock. Times are elapsed seconds; indexes address recorded points. */
export type TrainingTickEvent = CustomEvent<{
  t: number;
  at: number;
  beat: ReturnType<typeof trainingBeat>;
  index: number;
}>;
