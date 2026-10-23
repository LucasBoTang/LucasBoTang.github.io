import { smoothstep } from '../../../lib/easing.ts';
import { seeded } from '../../../lib/random.ts';

const channels = {
  a: { seed: 11, interval: 0.095 },
  b: { seed: 37, interval: 0.113 },
  'a-value': { seed: 73, interval: 0.137 },
  'b-value': { seed: 97, interval: 0.121 },
} as const;

type SignalChannel = keyof typeof channels;
const channelNames = Object.keys(channels) as SignalChannel[];
const round = (value: number) => Math.round(value * 100) / 100;

/** Quiet instability has unequal sample lengths, rather than a metronomic shake. */
function quietSignal(time: number, seed: number, interval: number) {
  let step = 0;
  let next = interval * (0.55 + seeded(seed) * 0.9);
  while (time >= next) {
    step++;
    next += interval * (0.55 + seeded(seed + step * 13) * 0.9);
  }
  return {
    step,
    x: round((seeded(seed + step * 19 + 1) * 2 - 1) * 0.18),
    y: round((seeded(seed + step * 19 + 2) * 2 - 1) * 0.1),
  };
}

/** A brief displacement, recoil and recovery share one fault; echoes clear between faults. */
export function sampleParameterSignal(time: number, channel: SignalChannel, reducedMotion = false) {
  if (reducedMotion)
    return {
      step: -1,
      x: 0,
      y: 0,
      opacity: 1,
      tearX: 0,
      tearOpacity: 0,
      trailX: 0,
      trailY: 0,
      trailOpacity: 0,
      top: 40,
      bottom: 40,
    };
  const { seed, interval } = channels[channel];
  const period = interval * 11;
  const shifted = Math.max(0, time) + seeded(seed + 9) * period;
  const packet = Math.floor(shifted / period);
  const local = shifted - packet * period;
  const packetSeed = seed + packet * 137;
  const noise = (offset: number) => seeded(packetSeed + offset);
  const quiet = quietSignal(local, packetSeed, interval);
  const start = period * (0.1 + noise(3) * 0.42);
  const durations = [
    0.035 + noise(4) * 0.035,
    0.03 + noise(5) * 0.03,
    0.045 + noise(6) * 0.04,
    0.07 + noise(7) * 0.07,
  ];
  let age = local - start;
  let stage = 0;
  while (stage < durations.length && age >= durations[stage]) age -= durations[stage++];
  const active = age >= 0 && stage < durations.length;
  let x = quiet.x,
    y = quiet.y,
    trailX = 0,
    trailY = 0,
    trailOpacity = 0;
  if (active) {
    const anchor = quietSignal(start, packetSeed, interval);
    const direction = noise(8) > 0.5 ? 1 : -1;
    const vertical = (noise(9) * 2 - 1) * 0.28;
    const pulses = [1, -0.5, 0.35];
    const position = (pulse: number) => ({
      x: anchor.x * (1 - Math.abs(pulse)) + direction * 0.7 * pulse,
      y: anchor.y * (1 - Math.abs(pulse)) + vertical * pulse,
    });
    const current = position(pulses[Math.min(stage, 2)]);
    const recovery = stage === 3 ? smoothstep(age / durations[3]) : 0;
    x = current.x + (quiet.x - current.x) * recovery;
    y = current.y + (quiet.y - current.y) * recovery;
    if (channel.endsWith('-value')) {
      const prior = stage === 0 ? anchor : position(pulses[Math.min(stage - 1, 1)]);
      const echoAge = stage === 3 ? durations[2] + age : age;
      trailX = prior.x - x;
      trailY = prior.y - y;
      trailOpacity = 0.28 * Math.max(0, 1 - echoAge / 0.095) ** 2;
    }
  }
  const tear = active && stage < 2 ? Math.max(0, 1 - age / 0.045) : 0;
  const top = Math.round(20 + noise(10) * 45);
  const cutHeight = Math.round(12 + noise(11) * 6);
  return {
    step:
      packet * 100000 + quiet.step * 1000 + (active ? (stage + 1) * 100 + Math.floor(age * 60) : 0),
    x: round(x),
    y: round(y),
    opacity: round(active ? 0.93 + (1 - tear) * 0.07 : 1),
    tearX: tear ? round((noise(8) > 0.5 ? 1 : -1) * (1.2 + noise(12) * 0.6)) : 0,
    tearOpacity: round(tear * 0.42),
    trailX: round(trailX),
    trailY: round(trailY),
    trailOpacity: round(trailOpacity),
    top,
    bottom: 100 - top - cutHeight,
  };
}

/** Repeated letters share a signal; each numeric readout moves independently without changing value. */
export function createParameterSignals(root: HTMLElement) {
  const previous: Record<SignalChannel, number> = {
    a: NaN,
    b: NaN,
    'a-value': NaN,
    'b-value': NaN,
  };
  return (time: number, reducedMotion = false) => {
    for (const channel of channelNames) {
      const frame = sampleParameterSignal(time, channel, reducedMotion);
      if (frame.step === previous[channel]) continue;
      previous[channel] = frame.step;
      const write = (name: string, value: string | number) =>
        root.style.setProperty(`--input-${channel}-${name}`, String(value));
      write('x', `${frame.x}px`);
      write('y', `${frame.y}px`);
      write('opacity', frame.opacity);
      write('tear-x', `${frame.tearX}px`);
      write('echo', frame.tearOpacity);
      write('cut', `inset(${frame.top}% 0 ${frame.bottom}%)`);
      if (channel.endsWith('-value')) {
        write('trail-x', `${frame.trailX}px`);
        write('trail-y', `${frame.trailY}px`);
        write('trail-opacity', frame.trailOpacity);
      }
    }
  };
}
