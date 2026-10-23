import { clamp } from '../../../lib/easing.ts';

export type CaptionSweep = { start: number; end: number; reverse: boolean };
type FlowCaption = { label: HTMLElement; glow: HTMLElement; events: CaptionSweep[] };
type FlowWire = {
  /** The signal's path, for its geometry; its stroke, dash and opacity are set on `signal`. */
  band: SVGPathElement;
  signal: SVGGElement;
  gradient: SVGLinearGradientElement;
  length: number;
  window: readonly [number, number];
  reverse: readonly [number, number] | null;
  label: HTMLElement | null;
  labelAt: number;
  extent: number;
  angle: number;
  glow: HTMLElement | null;
};

export interface FlowFigure {
  root: HTMLElement;
  wires: FlowWire[];
  captions: FlowCaption[];
}

/** Apply one signal phase to the geometry measured by flow-layout. */
export function updateFlow(figure: FlowFigure, phase: number, staticFrame: boolean) {
  const { wires, captions } = figure;
  if (!wires.length) return;
  wires.forEach(
    ({ band, signal, gradient, length, window, reverse, label, labelAt, extent, angle, glow }) => {
      const returning = reverse !== null && phase >= reverse[0] && phase <= reverse[1] + 0.5;
      const [start, end] = returning ? reverse! : window;
      const active = !staticFrame && phase >= start && phase <= end + 0.5;
      if (!active) {
        if (signal.style.opacity !== '0') signal.style.opacity = '0';
        if (label) glow!.style.opacity = '0';
        return;
      }
      const progress = (phase - start) / (end - start);
      const head = (returning ? 1 - progress : progress) * length;
      if (label) {
        // Match the local tangent of the curved arrow at this annotation.
        // A decreasing head on the return pass naturally reverses this same sweep.
        const at = length * labelAt;
        const sweep = 50 + ((head - at) / Math.max(1, extent)) * 100;
        label.style.setProperty('--sweep-angle', `${angle}deg`);
        label.style.setProperty('--sweep', `${sweep}%`);
        glow!.style.opacity = sweep > -30 && sweep < 130 ? '1' : '0';
      }
      const tailLength = Math.min(48, length * 0.7);
      const tail = head + (returning ? tailLength : -tailLength);
      const lo = Math.max(0, Math.min(head, tail)),
        hi = Math.min(length, Math.max(head, tail));
      if (hi <= lo) {
        signal.style.opacity = '0';
        return;
      }
      const from = band.getPointAtLength(returning ? hi : lo),
        to = band.getPointAtLength(returning ? lo : hi);
      gradient.setAttribute('x1', String(from.x));
      gradient.setAttribute('y1', String(from.y));
      gradient.setAttribute('x2', String(to.x));
      gradient.setAttribute('y2', String(to.y));
      signal.style.strokeDasharray = `${hi - lo} ${length * 3}`;
      signal.style.strokeDashoffset = String(-lo);
      const enter = clamp((phase - start) / 0.12),
        exit = clamp((phase - end) / 0.5);
      signal.style.opacity = String(
        0.95 * (enter * enter * (3 - 2 * enter)) * (1 - exit * exit * (3 - 2 * exit)),
      );
    },
  );
  for (const { label, glow, events } of captions) {
    const event = events.find((event) => phase >= event.start && phase <= event.end);
    glow.style.opacity = !staticFrame && event ? '1' : '0';
    if (event) {
      const progress = (phase - event.start) / (event.end - event.start);
      label.style.setProperty(
        '--name-sweep',
        `${event.reverse ? 125 - progress * 150 : -25 + progress * 150}%`,
      );
    }
  }
}
