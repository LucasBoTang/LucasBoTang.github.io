import {
  timing,
  flowPhase,
  clamp,
  flowSpeed,
  configureFlow,
  captionSweepDuration,
} from './timeline';

const ns = 'http://www.w3.org/2000/svg';
type Wire = {
  band: SVGPathElement;
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
const figures: {
  root: HTMLElement;
  wires: Wire[];
}[] = [];
document.querySelectorAll<HTMLElement>('.training-flow').forEach((root) => {
  const svg = root.querySelector('svg')!,
    group = root.querySelector('[data-connections]')!;
  const figure = { root, wires: [] as Wire[] };
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
      const sweep = document.createElement('span');
      sweep.className = 'module-name-glow';
      sweep.textContent = label.textContent;
      sweep.setAttribute('aria-hidden', 'true');
      label.append(sweep);
    });
  const layout = () => {
    const r = root.getBoundingClientRect(),
      mobile = r.width <= 420;
    svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    const bounds = (selector: string) => {
      const b = root.querySelector(selector)!.getBoundingClientRect();
      return { x: b.x - r.x, y: b.y - r.y, w: b.width, h: b.height };
    };
    const node = (selector: string, half: number, height: number) => {
      const b = bounds(selector),
        s = Math.min(b.w / 280, 0.85) * (selector.includes('optimize') ? 0.46 : 1);
      return {
        x: b.x + b.w / 2,
        y: b.y + b.h / 2,
        left: b.x + b.w / 2 - half * s,
        right: b.x + b.w / 2 + half * s,
        top: b.y + b.h / 2 - height * s,
        bottom: b.y + b.h / 2 + height * s,
      };
    };
    const n = node('.predict canvas', 108, 84),
      o = node('.optimize canvas', 91, 68),
      g = node('.evaluate canvas', 111, 69);
    const polyBounds = bounds('.optimize canvas'),
      polyScale = Math.min(polyBounds.w / 280, 0.85) * 0.46;
    o.x += 7;
    o.y += 10;
    o.left = o.x - 64 * Math.min(polyBounds.w / 280, 0.85);
    o.right = o.x + 103 * polyScale;
    o.top = o.y - 79 * polyScale;
    o.bottom = o.y + 92 * polyScale;
    const gridScale = Math.min(bounds('.evaluate canvas').w / 280, 0.85);
    // Captions share one optical gap from the visible drawing envelope, not canvas edges.
    const captionGap = 12;
    const neuralBox = bounds('.predict canvas'),
      neuralS = Math.min(neuralBox.w / 280, 0.85);
    const neuralCaption = root.querySelector<HTMLElement>('.predict .module-label')!;
    neuralCaption.style.top = `${neuralBox.h / 2 + 12 - 80.4 * neuralS - 5.2 - captionGap - 16}px`;
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
    const featureLabel = root.querySelector<HTMLElement>('.input-label')!;
    featureLabel.style.left = '0px';
    featureLabel.style.top = `${mobile ? 230 : 208}px`;
    const data = bounds('.dataset-module');
    const datasetCaption = root.querySelector<HTMLElement>('.dataset-caption')!;
    const sheetScale = data.w / 140,
      sheetInset = (80 - 80 * sheetScale) / 2;
    datasetCaption.style.top = `${sheetInset + 6.5 * sheetScale - 2 - captionGap - 16}px`;
    datasetCaption.style.left = `${2 * sheetScale}px`;
    const gap = 12,
      neuralScale = Math.min(bounds('.predict canvas').w / 280, 0.85);
    const featureX = n.x - 108 * Math.cos(0.24) * neuralScale,
      featureY = n.y + 38.4 * neuralScale + gap;
    const gridInX = g.x + 81 * gridScale,
      gridInY = g.y - 69 * gridScale - gap,
      truthInY = g.y + 15 * gridScale;

    const portY = n.y + 1;
    const predictionAnchor = {
      x: (n.right + o.left) / 2 - (mobile ? 20 : 0),
      y: (portY + o.y) / 2 - (mobile ? 12 : 0),
    };
    const paths = [
      mobile
        ? `M${data.x + (data.w * 124) / 140 + gap} ${data.y + 10} C${data.x + (data.w * 124) / 140 + gap} ${data.y - 24} ${n.x} ${n.bottom + 44} ${n.x} ${n.bottom + gap + 10} L${n.x} ${n.bottom + gap}`
        : `M${data.x + 20 - gap} ${data.y + 40} C${data.x + 8} ${data.y - 2} ${featureX} ${featureY + 34} ${featureX} ${featureY}`,
      mobile
        ? `M${n.right + gap} ${portY} C${predictionAnchor.x + 56} ${portY + 20} ${predictionAnchor.x + 46} ${predictionAnchor.y} ${predictionAnchor.x + 34} ${predictionAnchor.y} H${predictionAnchor.x - 34} C${predictionAnchor.x - 46} ${predictionAnchor.y} ${o.left - gap - 24} ${o.y} ${o.left - gap - 10} ${o.y} L${o.left - gap} ${o.y}`
        : `M${n.right + gap} ${portY} C${n.right + gap + 12} ${portY} ${predictionAnchor.x - 46} ${predictionAnchor.y} ${predictionAnchor.x - 34} ${predictionAnchor.y} H${predictionAnchor.x + 34} C${predictionAnchor.x + 46} ${predictionAnchor.y} ${o.left - gap - 12} ${o.y} ${o.left - gap} ${o.y}`,
      `M${o.right + gap} ${o.y} C${o.right + gap + 42} ${o.y + 22} ${gridInX + 12} ${gridInY - 36} ${gridInX} ${gridInY}`,
      `M${data.x + (data.w * 124) / 140 + gap} ${data.y + data.h * 0.52} C${data.x + data.w + 24} ${data.y + data.h * 0.52 - 8} ${g.left - gap - 24} ${truthInY - 8} ${g.left - gap} ${truthInY}`,
    ];
    if (!mobile) {
      paths[0] = `M${data.x + 8} ${data.y + 40} C${n.left - 20} ${data.y + 28} ${n.left - 28} ${n.y + 34} ${n.left - gap} ${n.y + 12}`;
      paths[1] = `M${n.right + gap} ${portY} C${n.right + gap + 24} ${portY - 16} ${o.left - gap - 24} ${o.y + 16} ${o.left - gap} ${o.y}`;
      paths[3] = `M${data.x + (data.w * 124) / 140 + gap} ${data.y + data.h * 0.52} C${data.x + data.w + 30} ${data.y + data.h * 0.52 - 4} ${g.left - gap - 30} ${truthInY - 4} ${g.left - gap} ${truthInY}`;
    }
    if (mobile) {
      const featureEnd = { x: n.left + 24, y: n.bottom + gap };
      paths[0] = `M${data.x + 58} ${data.y - 34} C${data.x + 58} ${data.y - 66} ${featureEnd.x - 12} ${featureEnd.y + 40} ${featureEnd.x} ${featureEnd.y}`;
      const predictionEnd = { x: o.x + 10, y: o.y - 100 * Math.min(polyBounds.w / 280, 0.85) - 16 };
      paths[1] = `M${n.right + gap} ${portY} C${predictionEnd.x - 8} ${portY} ${predictionEnd.x} ${predictionEnd.y - 24} ${predictionEnd.x} ${predictionEnd.y}`;
      const modelCaption = bounds('.optimize .module-label'),
        decisionStartY = Math.max(o.bottom + 32, modelCaption.y + modelCaption.h + 10);
      paths[2] = `M${o.x + 18} ${decisionStartY} C${o.x + 18} ${decisionStartY + 20} ${gridInX} ${gridInY - 24} ${gridInX} ${gridInY}`;
      paths[3] = `M${data.x + data.w * 0.55} ${data.y + data.h + gap} C${data.x + data.w * 0.55} ${g.y + 8} ${g.left - gap - 30} ${g.y + 8} ${g.left - gap} ${g.y + 8}`;
    }
    const lengths = paths.map((d) => {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      return p.getTotalLength();
    });
    const reverseWindows = configureFlow(
      [...lengths.slice(0, 3), 0],
      216 * Math.cos(0.24) * neuralScale,
      polyScale,
    );
    root.dataset.simplexSpeed = String(flowSpeed);
    const windows: [number, number][] = [
      timing.input,
      timing.prediction,
      timing.decision,
      [timing.decision[1] - lengths[3] / flowSpeed, timing.decision[1]],
    ];
    group.replaceChildren();
    svg.querySelectorAll('[data-signal-gradient]').forEach((g) => g.remove());
    figure.wires = [];
    paths.forEach((d, i) => {
      const base = document.createElementNS(ns, 'path');
      base.setAttribute('d', d);
      base.setAttribute('marker-end', 'url(#dfl-flow-arrow)');
      if (i === 4) base.setAttribute('class', 'return');
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
      const selector = ['.input-label', '.prediction-label', '.decision-label', '.truth-label'][i];
      const label = selector ? root.querySelector<HTMLElement>(selector) : null;
      let labelAt =
        i === 0
          ? mobile
            ? 0.52
            : 0.22
          : i === 1
            ? mobile
              ? 0.55
              : 0.48
            : i === 3
              ? mobile
                ? 0.55
                : 0.5
              : mobile
                ? 0.65
                : 0.48;
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
      if (i === 2) labelAt = mobile ? 0.5 : 0.78;
      if (label && i === 0) {
        const anchor = base.getPointAtLength(length * labelAt),
          box = label.getBoundingClientRect(),
          word = label.querySelector('.dfl-label-content>span')!.getBoundingClientRect();
        label.style.left = `${anchor.x - word.width - 12}px`;
        label.style.top = `${anchor.y - box.height / 2}px`;
      }
      if (label && i === 2) {
        const anchor = base.getPointAtLength(length * labelAt),
          box = label.getBoundingClientRect(),
          word = label.querySelector('.dfl-label-content>span')!.getBoundingClientRect();
        label.style.left = `${anchor.x - word.width - 13}px`;
        label.style.top = `${anchor.y - box.height / 2}px`;
      }
      if (label && i > 0 && i !== 2) {
        const anchor = base.getPointAtLength(length * labelAt),
          box = label.getBoundingClientRect();
        label.style.left = `${Math.max(4, Math.min(r.width - box.width - 4, anchor.x - box.width / 2))}px`;
        label.style.top = `${anchor.y - box.height / 2}px`;
      }
      if (label && i === 1 && mobile) {
        const anchor = base.getPointAtLength(length * 0.55),
          box = label.getBoundingClientRect();
        label.style.left = `${anchor.x - box.width - 10}px`;
        label.style.top = `${n.bottom + 14}px`;
      }
      if (label && i === 3) {
        const anchor = base.getPointAtLength(length * labelAt),
          box = label.getBoundingClientRect();
        label.style.left = mobile
          ? `${data.x + data.w * 0.55 - box.width / 2}px`
          : `${Math.max(4, anchor.x - box.width / 2)}px`;
        label.style.top = mobile ? `${data.y + data.h + 4}px` : `${anchor.y - box.height - 8}px`;
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
      band.dataset.start = String(windows[i][0]);
      band.dataset.end = String(windows[i][1]);
      if (i !== 3 && reverseWindows[i]) {
        band.dataset.reverseStart = String(reverseWindows[i]![0]);
        band.dataset.reverseEnd = String(reverseWindows[i]![1]);
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
  figures.forEach(({ root, wires }) => {
    if (!wires.length) return;
    root.dataset.phase = phase.toFixed(2);
    wires.forEach(
      ({ band, gradient, length, window, reverse, label, labelAt, extent, angle, glow }) => {
        const returning = reverse !== null && phase >= reverse[0] && phase <= reverse[1] + 0.5;
        const [start, end] = returning ? reverse! : window;
        const active = !staticFrame && phase >= start && phase <= end + 0.5;
        if (!active) {
          if (band.style.opacity !== '0') band.style.opacity = '0';
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
          band.style.opacity = '0';
          return;
        }
        const from = band.getPointAtLength(returning ? hi : lo),
          to = band.getPointAtLength(returning ? lo : hi);
        gradient.setAttribute('x1', String(from.x));
        gradient.setAttribute('y1', String(from.y));
        gradient.setAttribute('x2', String(to.x));
        gradient.setAttribute('y2', String(to.y));
        band.style.strokeDasharray = `${hi - lo} ${length * 3}`;
        band.style.strokeDashoffset = String(-lo);
        const enter = clamp((phase - start) / 0.12),
          exit = clamp((phase - end) / 0.5);
        band.style.opacity = String(
          0.95 * (enter * enter * (3 - 2 * enter)) * (1 - exit * exit * (3 - 2 * exit)),
        );
      },
    );
    // Use the incoming wire's exact arrival, including responsive path lengths.
    // Dataset is a source; quality launches the return pass after its unlit pause.
    type NameEvent = {
      start: number;
      end: number;
      reverse: boolean;
    };
    const sweep = (start: number, end: number, reverse = false): NameEvent => ({
      start,
      end,
      reverse,
    });
    const neuralDuration = timing.prediction[0] - timing.neural;
    const nameEvents: [string, NameEvent[]][] = [
      [
        '.dataset-caption',
        [
          sweep(wires[0].window[0] - captionSweepDuration, wires[0].window[0], true),
          sweep(wires[3].window[0] - captionSweepDuration, wires[3].window[0]),
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
    for (const [selector, events] of nameEvents) {
      const label = root.querySelector<HTMLElement>(selector)!;
      const glow = label.querySelector<HTMLElement>('.module-name-glow')!;
      const event = events.find((event) => phase >= event.start && phase <= event.end);
      glow.style.opacity = !staticFrame && event ? '1' : '0';
      if (event) {
        const progress = (phase - event.start) / (event.end - event.start);
        label.style.setProperty(
          '--name-sweep',
          `${event.reverse ? 125 - progress * 150 : -25 + progress * 150}%`,
        );
        glow.dataset.start = String(event.start);
        glow.dataset.end = String(event.end);
        glow.dataset.direction = event.reverse ? 'reverse' : 'forward';
      }
    }
  });
}
