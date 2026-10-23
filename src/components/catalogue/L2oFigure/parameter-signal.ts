import { seeded } from '../../../lib/random.ts';

const channels = {
  a: { seed: 11, interval: 0.095 },
  b: { seed: 37, interval: 0.113 },
  'a-value': { seed: 73, interval: 0.137 },
  'b-value': { seed: 97, interval: 0.121 },
} as const;
type SignalChannel = keyof typeof channels;
const channelNames = Object.keys(channels) as SignalChannel[];

/** Small stepped motion stays active; only a few samples carry a displaced slice. */
export function sampleParameterSignal(time: number, channel: SignalChannel, reducedMotion = false) {
  if (reducedMotion)
    return { step: -1, x: 0, y: 0, opacity: 1, tearX: 0, tearOpacity: 0, top: 40, bottom: 40 };
  const { seed, interval } = channels[channel];
  const step = Math.floor(Math.max(0, time) / interval);
  const noise = (offset: number) => seeded(seed + step * 19 + offset);
  const round = (value: number) => Math.round(value * 100) / 100;
  const top = Math.round(18 + noise(6) * 45);
  const torn = noise(3) > 0.9;
  return {
    step,
    x: round((noise(0) * 2 - 1) * 0.7),
    y: round((noise(1) * 2 - 1) * 0.5),
    opacity: round(0.9 + noise(2) * 0.1),
    tearX: torn ? round((noise(4) > 0.5 ? 1 : -1) * (1.2 + noise(5) * 0.6)) : 0,
    tearOpacity: torn ? 0.45 : 0,
    top,
    bottom: 100 - top - 18,
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
    }
  };
}
