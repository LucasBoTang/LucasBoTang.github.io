import { smoothstep as smooth } from '../../../lib/easing.ts';
import { createFigureClock } from '../../../lib/figure-clock.ts';
import { whenFigureReady } from '../../../lib/figure-ready';
import { MATRIX, SCAN_BAND } from './gpu-layout.ts';
import { matrixMotionAt, matrixPlaybackRate } from './matrix-motion.ts';

type VectorKey = 'x' | 'a' | 'y' | 'at';
interface MatrixProductRecording {
  maxRms: Record<VectorKey, number>;
  frames: ReadonlyArray<Record<VectorKey, readonly number[]> & { iteration: number }>;
}
interface VectorLayout {
  key: VectorKey;
  phase: 0 | 1;
  result: boolean;
  dimension: 'height' | 'width';
  edge?: 'x' | 'y';
  anchor?: number;
}

const BAR = { minimumSize: 3, sizeRange: 21, opacity: 0.85, logGain: 9 };
const VECTOR_LAYOUT: VectorLayout[] = [
  { key: 'x', phase: 0, result: false, dimension: 'height', edge: 'y', anchor: 135 },
  { key: 'a', phase: 0, result: true, dimension: 'width' },
  { key: 'y', phase: 1, result: false, dimension: 'width', edge: 'x', anchor: 69 },
  { key: 'at', phase: 1, result: true, dimension: 'height' },
];

/** Find a part of GpuFigure's own markup, failing loudly if it is missing. */
function requireElement(root: ParentNode, selector: string): Element {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`GpuFigure is missing ${selector}.`);
  }
  return element;
}

/** Write an attribute only when its rounded value changes: about a third of this figure's
 * writes repeat the value already there, and each write still invalidates the element's style. */
function setAttribute(element: Element, name: string, value: number | string) {
  const text = typeof value === 'number' ? String(Math.round(value * 1000) / 1000) : value;
  if (element.getAttribute(name) !== text) element.setAttribute(name, text);
}

function setOpacity(element: Element, value: number) {
  setAttribute(element, 'opacity', value);
}

/**
 * Animate matrix products and the matching hardware lights on one clock.
 * Call once per GPU composition; its component owns the required SVG markup.
 */
export function initializeGpuFigure(root: HTMLElement, products: MatrixProductRecording) {
  const initialFrame = products.frames[0];
  const transposeMinimum = Math.min(...initialFrame.at);
  const transposeRange = Math.max(1e-12, Math.max(...initialFrame.at) - transposeMinimum);
  const vectors = VECTOR_LAYOUT.map((layout) => ({
    magnitudes: initialFrame[layout.key].map((value) =>
      layout.key === 'at'
        ? 0.25 + (0.75 * (value - transposeMinimum)) / transposeRange
        : Math.log1p((BAR.logGain * value) / products.maxRms[layout.key]) / Math.log1p(BAR.logGain),
    ),
    wasVisible: true,
    ...layout,
    group: requireElement(root, `[data-vector="${layout.key}"]`),
    bars: Array.from(root.querySelectorAll(`[data-${layout.key}]`), (element, index) => {
      const seed = (index + 1) * 73 + layout.key.charCodeAt(0) * 19;
      setOpacity(element, BAR.opacity);
      return { element, seed, period: 390 + (seed % 310), offset: (seed % 29) / 29 };
    }),
  }));
  const productFlow = requireElement(root, '[data-flow="a"]');
  const transposeProductFlow = requireElement(root, '[data-flow="at"]');
  const scanDown = requireElement(root, '[data-matrix-scan="down"]');
  const scanRight = requireElement(root, '[data-matrix-scan="right"]');
  const outputArrows = root.querySelectorAll('[data-flow-output]');
  const indicators = requireElement(root, '[data-gpu-lights]');
  const chips = requireElement(root, '[data-gpu-chips]');
  const bus = requireElement(root, '[data-gpu-bus]');
  const pulses = bus.querySelectorAll('[data-bus-pulse]');
  // Flow topology and dash setup never change; only displacement and reveal vary per frame.
  const flows = (
    [
      [productFlow, true],
      [transposeProductFlow, false],
    ] as const
  ).flatMap(([flow, downInput]) =>
    [...flow.querySelectorAll<SVGGElement>(':scope > g')].map((group) => {
      const output = group.hasAttribute('data-flow-output');
      const paths = [...group.querySelectorAll('path')];
      for (const path of paths) {
        path.setAttribute('pathLength', '1');
        path.setAttribute('stroke-dasharray', '1 1');
      }
      return { group, paths, output, down: output ? !downInput : downInput };
    }),
  );
  function render(elapsedMs: number, reducedMotion: boolean) {
    const motion = matrixMotionAt(elapsedMs, reducedMotion);

    for (const vector of vectors) {
      const opacity = vector.result ? motion.resultOpacity : motion.inputOpacity;
      const alpha = reducedMotion ? 1 : vector.phase === motion.phase ? opacity : 0;
      const visible = alpha > 0;
      if (!visible && !vector.wasVisible) continue;
      vector.wasVisible = visible;
      setOpacity(vector.group, alpha);
      setAttribute(vector.group, 'visibility', visible ? 'visible' : 'hidden');
      vector.bars.forEach(({ element: bar, seed, period, offset }, index) => {
        const magnitude = vector.magnitudes[index];
        // Smooth deterministic irregular motion, with a different clock per bar.
        const noise = (step: number) => (((seed * (step * 37 + 17)) % 997) / 996) * 2 - 1;
        const clock = elapsedMs / period + offset;
        const segment = Math.floor(clock);
        const mix = smooth(clock - segment);
        const jitter = reducedMotion
          ? 0
          : 1.6 * (noise(segment) * (1 - mix) + noise(segment + 1) * mix);
        const size = visible ? BAR.minimumSize + BAR.sizeRange * magnitude + jitter : 0;
        setAttribute(bar, vector.dimension, size);
        // Input vectors keep their matrix-facing edge fixed.
        if (vector.edge !== undefined && vector.anchor !== undefined) {
          setAttribute(bar, vector.edge, vector.anchor - size);
        }
      });
    }

    setAttribute(
      scanDown,
      'y',
      MATRIX.y - SCAN_BAND.height + (MATRIX.height + SCAN_BAND.height) * motion.scanProgress,
    );
    setAttribute(
      scanRight,
      'x',
      MATRIX.x - SCAN_BAND.width + (MATRIX.width + SCAN_BAND.width) * motion.scanProgress,
    );
    setOpacity(scanDown, motion.downScanOpacity);
    setOpacity(scanRight, motion.rightScanOpacity);
    for (const arrow of outputArrows) setOpacity(arrow, motion.outputArrowOpacity);

    for (const { group, paths, output, down } of flows) {
      const { reveal, shift } = output ? motion.outputFlow : motion.inputFlow;
      setAttribute(group, 'transform', `translate(${down ? 0 : shift} ${down ? shift : 0})`);
      for (const path of paths) {
        setAttribute(path, 'stroke-dashoffset', 1 - reveal);
      }
    }

    setOpacity(indicators, motion.indicatorOpacity);
    setOpacity(chips, motion.chipOpacity);
    setOpacity(bus, motion.busOpacity);
    for (const pulse of pulses) setAttribute(pulse, 'stroke-dashoffset', motion.busOffset);
    setOpacity(productFlow, motion.productOpacity);
    setOpacity(transposeProductFlow, motion.transposeProductOpacity);
  }

  return createFigureClock(root, render, { rate: matrixPlaybackRate, startWhen: whenFigureReady });
}
