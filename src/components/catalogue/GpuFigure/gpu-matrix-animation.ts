import { whenFigureReady } from '../../../lib/figure-ready';
import { smoothstep as smooth } from './easing.ts';
import { MATRIX, SCAN_BAND } from './gpu-layout.ts';
import { createPlayback } from './playback.ts';

type VectorKey = 'x' | 'a' | 'y' | 'at';
interface MatrixProducts {
  maxRms: Record<VectorKey, number>;
  frames: Array<Record<VectorKey, number[]> & { iteration: number }>;
}
interface VectorLayout {
  key: VectorKey;
  phase: 0 | 1;
  delay: number;
  dimension: 'height' | 'width';
  edge?: 'x' | 'y';
  anchor?: number;
}

const PHRASE_DURATION = 6500;
const CYCLE_DURATION = 2 * PHRASE_DURATION;
// Envelope and hardware timings are in seconds within each phrase.
const ENVELOPE = { fadeDuration: 0.6, fadeOutStart: 5.7, arrowsStart: 0.75 };
const SCAN = {
  start: 1,
  duration: 0.95,
  resultStart: 2,
  arrowFadeDuration: 0.3,
};
const LIGHTS = {
  start: 0.75,
  riseDuration: 1,
  fadeOutStart: 2.5,
  fadeOutDuration: 1.5,
  indicatorOpacity: 0.85,
  chipOpacity: 0.9,
};
const BUS_PULSE = {
  start: 1,
  duration: 1.65,
  fadeInFraction: 0.18,
  fadeOutStart: 0.78,
  fadeOutFraction: 0.22,
  opacity: 0.85,
  initialOffset: 18,
  travelDistance: 136,
};
const BAR = { minimumSize: 3, sizeRange: 21, opacity: 0.85, logGain: 9 };
const VECTOR_LAYOUT: VectorLayout[] = [
  { key: 'x', phase: 0, delay: 0, dimension: 'height', edge: 'y', anchor: 135 },
  { key: 'a', phase: 0, delay: SCAN.resultStart, dimension: 'width' },
  { key: 'y', phase: 1, delay: 0, dimension: 'width', edge: 'x', anchor: 69 },
  { key: 'at', phase: 1, delay: SCAN.resultStart, dimension: 'height' },
];

/** Find a part of GpuFigure's own markup, failing loudly if it is missing. */
function requireElement(root: ParentNode, selector: string): Element {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`GpuFigure is missing ${selector}.`);
  }
  return element;
}

function setOpacity(element: Element, value: number) {
  element.setAttribute('opacity', String(value));
}

/**
 * Animate matrix products and the matching hardware lights on one clock.
 * Call once per GPU composition; its component owns the required SVG markup.
 */
export function initializeGpuFigure(
  root: HTMLElement,
  products: MatrixProducts,
  browser: Window & typeof globalThis,
) {
  const vectors = VECTOR_LAYOUT.map((layout) => ({
    ...layout,
    bars: root.querySelectorAll(`[data-${layout.key}]`),
    label: requireElement(root, `[data-vector="${layout.key}"] [data-math-label]`),
  }));
  const flowA = requireElement(root, '[data-flow="a"]');
  const flowAT = requireElement(root, '[data-flow="at"]');
  const scanDown = requireElement(root, '[data-matrix-scan="down"]');
  const scanRight = requireElement(root, '[data-matrix-scan="right"]');
  const outputArrows = root.querySelectorAll('[data-flow-output]');
  const indicators = requireElement(root, '[data-gpu-lights]');
  const chips = requireElement(root, '[data-gpu-chips]');
  const bus = requireElement(root, '[data-gpu-bus]');
  const pulses = bus.querySelectorAll('[data-bus-pulse]');
  function render(elapsed: number, reducedMotion: boolean) {
    const frame = products.frames[0];
    const phase = Math.floor((elapsed % CYCLE_DURATION) / PHRASE_DURATION);
    const seconds = (elapsed % PHRASE_DURATION) / 1000;
    // Each phrase ends with a fade, then 0.35 seconds of empty space.
    const envelope = (start: number) =>
      smooth((seconds - start) / ENVELOPE.fadeDuration) *
      (1 - smooth((seconds - ENVELOPE.fadeOutStart) / ENVELOPE.fadeDuration));

    for (const vector of vectors) {
      const alpha = reducedMotion ? 1 : vector.phase === phase ? envelope(vector.delay) : 0;
      const visible = alpha > 0;
      setOpacity(vector.label, alpha);
      vector.label.setAttribute('visibility', visible ? 'visible' : 'hidden');
      vector.bars.forEach((bar, index) => {
        const value = frame[vector.key][index];
        let magnitude =
          Math.log1p((BAR.logGain * value) / products.maxRms[vector.key]) / Math.log1p(BAR.logGain);
        // Expand the narrow Aᵀy range with one fixed affine display scale.
        if (vector.key === 'at') {
          const minimum = Math.min(...frame.at);
          const maximum = Math.max(...frame.at);
          magnitude = 0.25 + (0.75 * (value - minimum)) / Math.max(1e-12, maximum - minimum);
        }
        // Smooth deterministic irregular motion, with a different clock per bar.
        const seed = (index + 1) * 73 + vector.key.charCodeAt(0) * 19;
        const noise = (step: number) => (((seed * (step * 37 + 17)) % 997) / 996) * 2 - 1;
        const clock = elapsed / (390 + (seed % 310)) + (seed % 29) / 29;
        const segment = Math.floor(clock);
        const mix = smooth(clock - segment);
        const jitter = reducedMotion
          ? 0
          : 1.6 * (noise(segment) * (1 - mix) + noise(segment + 1) * mix);
        const size = visible ? BAR.minimumSize + BAR.sizeRange * magnitude + jitter : 0;
        bar.setAttribute(vector.dimension, String(size));
        // Input vectors keep their matrix-facing edge fixed.
        if (vector.edge !== undefined && vector.anchor !== undefined) {
          bar.setAttribute(vector.edge, String(vector.anchor - size));
        }
        setOpacity(bar, BAR.opacity * alpha);
        bar.setAttribute('visibility', size > 0 ? 'visible' : 'hidden');
      });
    }

    // Finish sweeping the density mask before revealing the products.
    const scanProgress = smooth((seconds - SCAN.start) / SCAN.duration);
    const scanning =
      !reducedMotion && seconds >= SCAN.start && seconds < SCAN.start + SCAN.duration;
    scanDown.setAttribute(
      'y',
      String(MATRIX.y - SCAN_BAND.height + (MATRIX.height + SCAN_BAND.height) * scanProgress),
    );
    scanRight.setAttribute(
      'x',
      String(MATRIX.x - SCAN_BAND.width + (MATRIX.width + SCAN_BAND.width) * scanProgress),
    );
    const scanAlpha =
      smooth((seconds - SCAN.start) / 0.18) *
      (1 - smooth((seconds - (SCAN.start + SCAN.duration - 0.18)) / 0.18));
    setOpacity(scanDown, scanning && phase === 0 ? scanAlpha : 0);
    setOpacity(scanRight, scanning && phase === 1 ? scanAlpha : 0);
    for (const arrow of outputArrows) {
      setOpacity(
        arrow,
        reducedMotion
          ? 0
          : smooth((seconds - SCAN.resultStart) / SCAN.arrowFadeDuration) *
              (1 - smooth((seconds - ENVELOPE.fadeOutStart) / ENVELOPE.fadeDuration)),
      );
    }

    // Reveal shaft then tip along the path; one restrained directional gesture.
    for (const [flow, downInput] of [
      [flowA, true],
      [flowAT, false],
    ] as const) {
      for (const group of flow.querySelectorAll<SVGGElement>(':scope > g')) {
        const output = group.hasAttribute('data-flow-output');
        const age = seconds - (output ? SCAN.resultStart : ENVELOPE.arrowsStart);
        const reveal = reducedMotion ? 0 : smooth(age / 0.38);
        const nudge =
          age > 0.38 && age < 0.94 ? 1.5 * Math.sin((Math.PI * (age - 0.38)) / 0.56) ** 2 : 0;
        const down = output ? !downInput : downInput;
        group.setAttribute('transform', `translate(${down ? 0 : nudge} ${down ? nudge : 0})`);
        for (const path of group.querySelectorAll('path')) {
          path.setAttribute('pathLength', '1');
          path.setAttribute('stroke-dasharray', '1 1');
          path.setAttribute('stroke-dashoffset', String(1 - reveal));
        }
      }
    }

    const breath = reducedMotion
      ? 0
      : smooth((seconds - LIGHTS.start) / LIGHTS.riseDuration) *
        (1 - smooth((seconds - LIGHTS.fadeOutStart) / LIGHTS.fadeOutDuration));
    setOpacity(indicators, LIGHTS.indicatorOpacity * breath);
    setOpacity(chips, LIGHTS.chipOpacity * breath);
    const travel = Math.max(0, Math.min(1, (seconds - BUS_PULSE.start) / BUS_PULSE.duration));
    const busOpacity = reducedMotion
      ? 0
      : smooth(travel / BUS_PULSE.fadeInFraction) *
        (1 - smooth((travel - BUS_PULSE.fadeOutStart) / BUS_PULSE.fadeOutFraction));
    setOpacity(bus, BUS_PULSE.opacity * busOpacity);
    for (const pulse of pulses) {
      pulse.setAttribute(
        'stroke-dashoffset',
        String(BUS_PULSE.initialOffset - BUS_PULSE.travelDistance * travel),
      );
    }
    const arrows = envelope(ENVELOPE.arrowsStart);
    setOpacity(flowA, reducedMotion || phase === 1 ? 0 : arrows);
    setOpacity(flowAT, reducedMotion || phase === 0 ? 0 : arrows);
  }

  return createPlayback(root, browser, render, { startWhen: whenFigureReady });
}
