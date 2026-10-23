import { clamp, smoothstep } from '../../../lib/easing.ts';

export const convergenceChannels = ['primal', 'dual', 'gap'] as const;
type ConvergenceChannel = (typeof convergenceChannels)[number];

interface ConvergencePoint extends Record<ConvergenceChannel, number> {
  iteration: number;
  reported_seconds: number;
  restart: boolean;
  restart_count: number;
}

/** Only the recorded fields needed by playback; the source retains all provenance. */
interface ConvergenceRecording {
  points: readonly ConvergencePoint[];
  metadata: { illustrative_h100_time: { scale: number } };
}

export const convergenceTiming = {
  leadInMs: 500,
  traceDurationMs: 18000,
  reducedTimeMs: 19000,
  resultHoldMs: 2000,
  fadeMs: 400,
  resetPauseMs: 100,
} as const;

const fadeStartMs =
  convergenceTiming.leadInMs + convergenceTiming.traceDurationMs + convergenceTiming.resultHoldMs;
const cycleDurationMs = fadeStartMs + convergenceTiming.fadeMs + convergenceTiming.resetPauseMs;

/** Repeat the recording on one clock; hide the reset and preserve a readable final hold. */
export function convergenceCycleAt(elapsedMs: number, reducedMotion: boolean) {
  if (reducedMotion) return { elapsedMs: convergenceTiming.reducedTimeMs, opacity: 1 };
  const phaseMs = elapsedMs % cycleDurationMs;
  const entrance = elapsedMs < cycleDurationMs ? 1 : smoothstep(phaseMs / convergenceTiming.fadeMs);
  return {
    elapsedMs: phaseMs,
    opacity: entrance * (1 - smoothstep((phaseMs - fadeStartMs) / convergenceTiming.fadeMs)),
  };
}

export interface ConvergenceFrame {
  iteration: number;
  recordIndex: number;
  previous: ConvergencePoint;
  next: ConvergencePoint;
  fraction: number;
  reading: ConvergencePoint;
  started: boolean;
  complete: boolean;
}

interface ConvergenceReadings {
  iteration: string;
  time: string;
  restarts: string;
  channels: Record<ConvergenceChannel, string>;
  restarting: boolean;
}

export interface ConvergenceModel {
  points: readonly ConvergencePoint[];
  final: ConvergencePoint;
  logFloor: number;
  logCeiling: number;
  timeScale: number;
  sample(elapsedMs: number, reducedMotion: boolean): ConvergenceFrame;
}

/** The cursor moves continuously; readings hold the preceding recorded sample until completion. */
export function createConvergenceModel(recording: ConvergenceRecording): ConvergenceModel {
  const points = recording.points;
  const final = points.at(-1);
  if (!final) throw new Error('GPU convergence recording must contain at least one sample.');
  const values = points.flatMap((point) => convergenceChannels.map((channel) => point[channel]));
  const logFloor = Math.min(
    -10,
    Math.floor(Math.log10(Math.min(...values.filter((value) => value > 0)))),
  );
  const logCeiling = Math.max(-1, Math.ceil(Math.log10(Math.max(...values))));
  return {
    points,
    final,
    logFloor,
    logCeiling,
    timeScale: recording.metadata.illustrative_h100_time.scale,
    sample(elapsedMs, reducedMotion) {
      const progress = reducedMotion
        ? 1
        : clamp((elapsedMs - convergenceTiming.leadInMs) / convergenceTiming.traceDurationMs);
      const iteration = progress * final.iteration;
      const foundIndex = points.findIndex((point) => point.iteration >= iteration);
      const recordIndex = foundIndex < 0 ? points.length - 1 : foundIndex;
      const next = points[recordIndex];
      const previous = points[Math.max(0, recordIndex - 1)];
      const fraction =
        next.iteration === previous.iteration
          ? 0
          : clamp((iteration - previous.iteration) / (next.iteration - previous.iteration));
      const complete = progress >= 1;
      return {
        iteration,
        recordIndex,
        previous,
        next,
        fraction,
        reading: complete ? final : previous,
        started: iteration >= points[0].iteration,
        complete,
      };
    },
  };
}

/** Scientific precision and illustrative time scaling are independent of SVG layout. */
export function formatConvergenceReadings(
  frame: ConvergenceFrame,
  timeScale: number,
): ConvergenceReadings {
  const { reading, started } = frame;
  const residual = (value: number) => (started ? value.toExponential(1) : '—');
  return {
    iteration: started ? reading.iteration.toLocaleString('en-US') : '—',
    time: started ? (reading.reported_seconds * timeScale).toFixed(1) : '—',
    restarts: started ? String(reading.restart_count).padStart(2, '0') : '00',
    channels: {
      primal: residual(reading.primal),
      dual: residual(reading.dual),
      gap: residual(reading.gap),
    },
    restarting: !frame.complete && started && reading.restart,
  };
}
