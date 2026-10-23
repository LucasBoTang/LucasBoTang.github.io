// One pace control keeps path travel, computation, icons and readouts in step.
const pace = 1.18;

/** The lower flow has its own steady cadence, anchored to completed integer predictions. */
export const trainingCadence = {
  pulse: 0.4 / pace,
  point: 0.12 / pace,
  action: 0.6 / pace,
  reading: 0.3 / pace,
  stagger: 0.072 / pace,
};

/** A uniform lower-flow sequence ends at the recorded integer point's arrival. */
export function trainingBeat(integer: number) {
  const pulse = trainingCadence.pulse;
  return {
    mapping: integer - pulse * 7,
    relaxed: integer - pulse * 5,
    hidden: integer - pulse * 3,
    continuous: integer - pulse * 2,
    rounding: integer - pulse * 2,
    integer,
    loss: integer + pulse,
    end: integer + pulse * 3,
  };
}

/** Each projected unit takes the same time, across every checkpoint boundary. */
export function trainingTimeline(segmentLengths: number[]) {
  const speed = 0.35 * pace;
  // Leave enough lead-in for the first full computation, without changing path speed.
  const arrivals = [
    Math.max(trainingCadence.pulse * 3, trainingCadence.pulse * 7 - segmentLengths[0] / speed),
  ];
  for (const length of segmentLengths)
    arrivals.push(arrivals[arrivals.length - 1] + length / speed);
  const beats = Array.from({ length: arrivals.length / 2 }, (_, i) =>
    trainingBeat(arrivals[2 * i + 1]),
  );
  return {
    speed,
    beats,
    arrivals,
    starts: arrivals.map((_, i) => (i ? arrivals[i - 1] : 0)),
    cycle: arrivals[arrivals.length - 1] + 2.4,
  };
}

/** Every connector and network scan gets one equal beat before the reading refreshes. */
export function trainingSignals(beat: ReturnType<typeof trainingBeat>) {
  const mappingMid = (beat.mapping + beat.relaxed) / 2;
  const correctionMid = (beat.relaxed + beat.hidden) / 2;
  return {
    mapping: [beat.mapping, mappingMid],
    mappingScan: [mappingMid, beat.relaxed],
    correction: [beat.relaxed, correctionMid],
    correctionScan: [correctionMid, beat.hidden],
    update: [beat.hidden, beat.continuous],
    loss: [beat.integer, beat.loss],
  } as const;
}

/** A quiet return sweep finishes before the next forward pass starts. */
export function trainingReset(cycle: number) {
  return {
    relaxed: cycle - 0.96,
    hidden: cycle - 0.82,
    integer: cycle - 0.68,
    loss: cycle - 0.54,
    hud: cycle - 0.4,
  };
}

const exhaleAngle = Math.PI * 2 * 0.58;
const breathSkew = (exhaleAngle - Math.PI) / (1 - Math.cos(exhaleAngle));

/** A smooth periodic phase keeps the longer exhale without splicing two different easings. */
export function surfaceOpacityAt(phase: number, trainingCycle: number, reducedMotion = false) {
  if (reducedMotion) return 1;
  const angle = (phase / trainingCycle) * Math.PI * 8;
  const breath = angle - breathSkew * (1 - Math.cos(angle));
  return 0.48 + 0.26 * (1 + Math.cos(breath));
}
