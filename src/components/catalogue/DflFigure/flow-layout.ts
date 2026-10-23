import { updateFlow, type CaptionSweep, type FlowFigure } from './flow-motion';
import { moduleScale, networkGeometry, polytopeScale } from './geometry';
import { timing, flowPhase, flowSpeed, configureFlow, captionSweepDuration } from './timeline';

const ns = 'http://www.w3.org/2000/svg';
const sweep = (start: number, end: number, reverse = false): CaptionSweep => ({
  start,
  end,
  reverse,
});
const figures: FlowFigure[] = [];
// Order matches the four paths: features, predictions, decisions, observed costs.
const wireLabels = [
  { selector: '.input-label', mobile: 0.49, desktop: 0.48 },
  { selector: '.prediction-label', mobile: 0.55, desktop: 0.48 },
  { selector: '.decision-label', mobile: 0.5, desktop: 0.78 },
  { selector: '.truth-label', mobile: 0.7, desktop: 0.5 },
];

document.querySelectorAll<HTMLElement>('.training-flow').forEach((root) => {
  const svg = root.querySelector<SVGSVGElement>('.flow-wires')!,
    group = root.querySelector('[data-connections]')!;
  const figure: FlowFigure = { root, wires: [], captions: [] };
  figures.push(figure);
  root.querySelectorAll<HTMLElement>('.flow-label').forEach((label) => {
    const copy = label.querySelector('.dfl-label-content')!.cloneNode(true) as HTMLElement;
    copy.classList.add('label-glow');
    copy.setAttribute('aria-hidden', 'true');
    label.append(copy);
  });
  root
    .querySelectorAll<HTMLElement>('.module-label,.dataset-caption,.loss-node')
    .forEach((label) => {
      const captionGlow = document.createElement('span');
      captionGlow.className = 'module-name-glow';
      captionGlow.textContent = label.textContent;
      captionGlow.setAttribute('aria-hidden', 'true');
      label.append(captionGlow);
    });
  const layout = () => {
    const rootBounds = root.getBoundingClientRect(),
      mobile = rootBounds.width <= 420;
    svg.setAttribute('viewBox', `0 0 ${rootBounds.width} ${rootBounds.height}`);
    const bounds = (selector: string) => {
      const b = root.querySelector(selector)!.getBoundingClientRect();
      return { x: b.x - rootBounds.x, y: b.y - rootBounds.y, w: b.width, h: b.height };
    };
    const node = (selector: string, half: number, height: number) => {
      const b = bounds(selector),
        s = moduleScale(b.w) * (selector.includes('optimize') ? polytopeScale : 1);
      return {
        x: b.x + b.w / 2,
        y: b.y + b.h / 2,
        left: b.x + b.w / 2 - half * s,
        right: b.x + b.w / 2 + half * s,
        top: b.y + b.h / 2 - height * s,
        bottom: b.y + b.h / 2 + height * s,
      };
    };
    const network = node('.predict canvas', networkGeometry.halfWidth, networkGeometry.halfHeight),
      optimizer = node('.optimize canvas', 91, 68),
      balance = node('.evaluate canvas', 111, 69);
    const polyBounds = bounds('.optimize canvas'),
      polyScale = moduleScale(polyBounds.w) * polytopeScale;
    optimizer.x += 7;
    optimizer.y += 10;
    optimizer.left = optimizer.x - 139 * polyScale;
    optimizer.right = optimizer.x + 103 * polyScale;
    optimizer.top = optimizer.y - 79 * polyScale;
    optimizer.bottom = optimizer.y + 92 * polyScale;
    const gridScale = moduleScale(bounds('.evaluate canvas').w);
    // Captions share one optical gap from the visible drawing envelope, not canvas edges.
    const captionGap = 12;
    const neuralBox = bounds('.predict canvas'),
      neuralS = moduleScale(neuralBox.w);
    const neuralCaption = root.querySelector<HTMLElement>('.predict .module-label')!;
    neuralCaption.style.top = `${neuralBox.h / 2 + 12 - networkGeometry.halfHeight * neuralS - 5.2 - captionGap - 16}px`;
    const polyCaption = root.querySelector<HTMLElement>('.optimize .module-label')!;
    polyCaption.style.top = `${polyBounds.h / 2 + 10 + 134 * polyScale + 3 + captionGap - 4}px`;
    polyCaption.style.left = '7px';
    const gridBox = bounds('.evaluate canvas'),
      gridCaption = root.querySelector<HTMLElement>('.loss-node')!;
    gridCaption.style.top = `${gridBox.y + gridBox.h / 2 + 63.5 * gridScale + 3 + captionGap - 8}px`;
    gridCaption.style.left = `${gridBox.x}px`;
    gridCaption.style.width = `${gridBox.w}px`;
    const quality = bounds('.loss-node');
    root.querySelector<HTMLElement>('.dataset-module')!.style.top =
      `${quality.y - (mobile ? 214 : 92)}px`;
    const data = bounds('.dataset-module');
    const datasetCaption = root.querySelector<HTMLElement>('.dataset-caption')!;
    const sheetScale = data.w / 140,
      sheetInset = (80 - 80 * sheetScale) / 2;
    datasetCaption.style.top = `${sheetInset + 6.5 * sheetScale - 2 - captionGap - 16}px`;
    datasetCaption.style.left = `${2 * sheetScale}px`;
    const gap = 12,
      neuralScale = moduleScale(bounds('.predict canvas').w);
    const featureX = network.x - networkGeometry.halfWidth * Math.cos(0.24) * neuralScale,
      featureY = network.y + networkGeometry.rowStep * neuralScale + gap;
    const gridInX = balance.x + 81 * gridScale,
      gridInY = balance.y - 69 * gridScale - gap,
      truthInY = balance.y + 15 * gridScale;

    const portY = network.y + 1;
    const predictionAnchor = {
      x: (network.right + optimizer.left) / 2 - (mobile ? 20 : 0),
      y: (portY + optimizer.y) / 2 - (mobile ? 12 : 0),
    };
    // Follow the raised neural network while leaving the two-line sign clear.
    // Leave the visible front sheet clear, including its corner in the compact layout.
    const cornerGap = gap / Math.SQRT2;
    const featureStart = mobile
      ? {
          x: data.x + 20 * sheetScale - cornerGap,
          y: data.y + sheetInset + 26 * sheetScale - cornerGap,
        }
      : {
          x: data.x + 20 * sheetScale - gap,
          y: data.y + sheetInset + 42 * sheetScale,
        };
    const predictionEnd = {
      x: optimizer.x + 10,
      y: optimizer.y - 100 * Math.min(polyBounds.w / 280, 0.85) - 16,
    };
    const modelCaption = bounds('.optimize .module-label');
    const decisionStartY = Math.max(optimizer.bottom + 32, modelCaption.y + modelCaption.h + 12);
    const paths = mobile
      ? [
          `M${featureStart.x} ${featureStart.y} C${featureX - 38} ${data.y - 38} ${featureX - 26} ${featureY + 68} ${featureX} ${featureY}`,
          `M${network.right + gap} ${portY} C${(network.right + gap + predictionEnd.x) / 2} ${portY + 10} ${predictionEnd.x - 18} ${predictionEnd.y - 24} ${predictionEnd.x} ${predictionEnd.y}`,
          `M${optimizer.x + 18} ${decisionStartY} C${optimizer.x + 18} ${decisionStartY + 24} ${gridInX} ${gridInY - 28} ${gridInX} ${gridInY}`,
          `M${data.x + data.w * 0.55} ${data.y + data.h + gap} C${data.x + data.w * 0.55} ${balance.y + 8} ${balance.left - gap - 32} ${balance.y + 8} ${balance.left - gap} ${balance.y + 8}`,
        ]
      : [
          `M${featureStart.x} ${featureStart.y} C${featureX - 42} ${featureStart.y - 40} ${featureX - 30} ${featureY + 68} ${featureX} ${featureY}`,
          `M${network.right + gap} ${portY} C${network.right + gap + 38} ${portY} ${optimizer.left - gap - 38} ${optimizer.y} ${optimizer.left - gap} ${optimizer.y}`,
          `M${optimizer.right + gap} ${optimizer.y} C${optimizer.right + gap + 42} ${optimizer.y + 22} ${gridInX + 12} ${gridInY - 36} ${gridInX} ${gridInY}`,
          `M${data.x + (data.w * 124) / 140 + gap} ${data.y + data.h * 0.52} C${data.x + data.w + 30} ${data.y + data.h * 0.52 - 4} ${balance.left - gap - 30} ${truthInY - 4} ${balance.left - gap} ${truthInY}`,
        ];
    const lengths = paths.map((d) => {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      return p.getTotalLength();
    });
    const reverseWindows = configureFlow(
      [...lengths.slice(0, 3), 0],
      networkGeometry.halfWidth * 2 * Math.cos(0.24) * neuralScale,
      polyScale,
    );
    const windows: [number, number][] = [
      timing.input,
      timing.prediction,
      timing.decision,
      [timing.decision[1] - lengths[3] / flowSpeed, timing.decision[1]],
    ];
    // Use the incoming wire's exact arrival, including responsive path lengths.
    // Dataset is a source; quality launches the return pass after its unlit pause.
    const neuralDuration = timing.prediction[0] - timing.neural;
    const nameEvents: [string, CaptionSweep[]][] = [
      [
        '.dataset-caption',
        [
          sweep(windows[0][0] - captionSweepDuration, windows[0][0], true),
          sweep(windows[3][0] - captionSweepDuration, windows[3][0]),
        ],
      ],
      [
        '.predict .module-label',
        [
          sweep(timing.neural, timing.prediction[0]),
          sweep(timing.reverse, timing.reverse + neuralDuration, true),
        ],
      ],
      [
        '.optimize .module-label',
        [
          sweep(timing.optimization, timing.decision[0]),
          sweep(...timing.reverseOptimization, true),
        ],
      ],
      [
        '.loss-node',
        [
          sweep(timing.evaluation, timing.evaluation + captionSweepDuration),
          sweep(timing.backward[0] - captionSweepDuration, timing.backward[0], true),
        ],
      ],
    ];
    figure.captions = nameEvents.map(([selector, events]) => {
      const label = root.querySelector<HTMLElement>(selector)!;
      return { label, glow: label.querySelector<HTMLElement>('.module-name-glow')!, events };
    });
    group.replaceChildren();
    svg.querySelectorAll('[data-signal-gradient]').forEach((gradient) => gradient.remove());
    figure.wires = [];
    paths.forEach((d, i) => {
      const base = document.createElementNS(ns, 'path');
      base.setAttribute('d', d);
      base.setAttribute('marker-end', 'url(#dfl-flow-arrow)');
      group.append(base);
      const length = base.getTotalLength();
      const gradient = document.createElementNS(ns, 'linearGradient');
      const id = `dfl-band-${figures.indexOf(figure)}-${i}`;
      gradient.id = id;
      gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
      gradient.setAttribute('data-signal-gradient', '');
      [
        [0, 0],
        [0.25, 0.06],
        [0.55, 0.3],
        [0.8, 0.75],
        [1, 1],
      ].forEach(([offset, opacity]) => {
        const stop = document.createElementNS(ns, 'stop');
        stop.setAttribute('offset', String(offset));
        stop.setAttribute('stop-color', 'var(--paper)');
        stop.setAttribute('stop-opacity', String(opacity));
        gradient.append(stop);
      });
      svg.querySelector('defs')!.append(gradient);
      const band = document.createElementNS(ns, 'path');
      band.setAttribute('d', d);
      band.setAttribute('class', 'signal');
      band.style.stroke = `url(#${id})`;
      group.append(band);
      const labelConfig = wireLabels[i];
      const label = root.querySelector<HTMLElement>(labelConfig.selector);
      let labelAt = mobile ? labelConfig.mobile : labelConfig.desktop;
      if (i === 1 && !mobile) {
        const target = predictionAnchor;
        let nearest = Infinity;
        for (let step = 0; step <= 300; step++) {
          const u = step / 300,
            p = base.getPointAtLength(length * u),
            distance = Math.hypot(p.x - target.x, p.y - target.y);
          if (distance < nearest) {
            nearest = distance;
            labelAt = u;
          }
        }
      }
      if (label) {
        // Anchor the mathematical symbol itself on the wire; its ink backing opens the gap.
        const anchor = base.getPointAtLength(length * labelAt);
        const symbol = label.querySelector<HTMLElement>('.dfl-label-content:not(.label-glow)>i')!;
        const lb = label.getBoundingClientRect(),
          sb = symbol.getBoundingClientRect();
        label.style.left = `${anchor.x - (sb.x - lb.x) - sb.width / 2}px`;
        label.style.top = `${anchor.y - (sb.y - lb.y) - sb.height / 2}px`;
      }
      const at = length * labelAt;
      const a = base.getPointAtLength(Math.max(0, at - 2)),
        b = base.getPointAtLength(Math.min(length, at + 2));
      const norm = Math.hypot(b.x - a.x, b.y - a.y) || 1,
        dx = (b.x - a.x) / norm,
        dy = (b.y - a.y) / norm;
      figure.wires.push({
        band,
        gradient,
        length,
        window: windows[i],
        reverse: i === 3 ? null : reverseWindows[i],
        label,
        labelAt,
        extent: label ? Math.abs(dx) * label.offsetWidth + Math.abs(dy) * label.offsetHeight : 1,
        angle: (Math.atan2(dx, -dy) * 180) / Math.PI,
        glow: label?.querySelector<HTMLElement>('.label-glow') ?? null,
      });
    });
  };
  new ResizeObserver(() => {
    layout();
    root.dispatchEvent(new Event('dfl:layout', { bubbles: true }));
  }).observe(root);
  document.fonts.ready.then(layout);
});

export function updateDflFlow(time: number, staticFrame = false) {
  const phase = flowPhase(time);
  figures.forEach((figure) => updateFlow(figure, phase, staticFrame));
}
