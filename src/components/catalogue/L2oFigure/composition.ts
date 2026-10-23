import { clamp } from '../../../lib/easing.ts';
import { enhance } from '../../../lib/lifecycle';
import { reducedMotionQuery } from '../../../lib/motion';
import { compositionPaths, type SignalStage } from './composition-layout';
import { createParameterSignals } from './parameter-signal';
import { trainingBeat, trainingCadence, trainingSignals } from './timing';
import type { TrainingTickEvent } from './training-events';

const NS = 'http://www.w3.org/2000/svg';
enhance<HTMLElement>('[data-l2o-material] [data-training-composition]', (root) => {
  const svg = root.querySelector<SVGSVGElement>('.training-connections')!;
  const updateParameters = createParameterSignals(root);
  const motionPreference = reducedMotionQuery();
  let reduced = motionPreference.matches;
  motionPreference.addEventListener('change', () => {
    reduced = motionPreference.matches;
  });

  let flows: { light: SVGPathElement; length: number; stage: SignalStage }[] = [];
  const operations = Array.from(root.querySelectorAll<HTMLElement>('.operation'));
  const lossPanel = root.querySelector<HTMLElement>('[data-module="loss"]')!;
  const networks = (['mapping', 'correction'] as const).map((name) => {
    const module = root.querySelector<HTMLElement>(`[data-module="${name}"]`)!;
    return {
      name,
      layers: Array.from(module.querySelectorAll('[data-layer]')),
      edges: Array.from(module.querySelectorAll('[data-layer-edge]'), (element) => ({
        element,
        layer: Number(element.getAttribute('data-layer-edge')),
      })),
    };
  });
  let activeBeat: ReturnType<typeof trainingBeat> | undefined;
  let signals = trainingSignals(trainingBeat(0));
  root.style.setProperty('--l2o-action-duration', `${trainingCadence.action}s`);
  root.style.setProperty('--l2o-pulse-duration', `${trainingCadence.pulse}s`);

  function box(name: string) {
    const a = root.getBoundingClientRect(),
      r = root.querySelector<HTMLElement>(`[data-module="${name}"]`)!.getBoundingClientRect();
    return {
      x: r.x - a.x,
      y: r.y - a.y,
      w: r.width,
      h: r.height,
      cx: r.x - a.x + r.width / 2,
      cy: r.y - a.y + r.height / 2,
    };
  }
  function path(d: string, stage: SignalStage) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('stroke', '#929ca7');
    const compact = root.clientWidth <= 560;
    p.style.strokeWidth = compact ? '2px' : '2.5px';
    p.setAttribute('opacity', '.8');
    svg.append(p);
    const length = p.getTotalLength();
    if (length < 1) return;
    const e = p.getPointAtLength(length),
      q = p.getPointAtLength(Math.max(0, length - 3)),
      a = Math.atan2(e.y - q.y, e.x - q.x),
      tip = document.createElementNS(NS, 'polygon'),
      head = compact ? 5.5 : Math.min(7, length * 0.42),
      half = head * 0.55;
    const baseX = e.x - head * Math.cos(a),
      baseY = e.y - head * Math.sin(a);
    tip.setAttribute(
      'points',
      `${e.x},${e.y} ${baseX - half * Math.sin(a)},${baseY + half * Math.cos(a)} ${baseX + half * Math.sin(a)},${baseY - half * Math.cos(a)}`,
    );
    tip.setAttribute('fill', '#aab4bf');
    svg.append(tip);
    const light = p.cloneNode() as SVGPathElement;
    light.setAttribute('class', 'signal');
    light.removeAttribute('opacity');
    light.setAttribute('stroke-dasharray', `${Math.min(24, length * 0.55)} ${length + 40}`);
    svg.append(light);
    flows.push({ light, length, stage });
  }
  function build() {
    const w = root.clientWidth,
      h = root.clientHeight;
    const input = box('parameters'),
      map = box('mapping'),
      cor = box('correction'),
      op = box('operations'),
      loss = box('loss'),
      mobile = w <= 560,
      gap = 7;
    const readings = root.querySelector<HTMLElement>('.parameter-values')!.getBoundingClientRect(),
      origin = root.getBoundingClientRect();
    const network = root
      .querySelector<SVGSVGElement>('.mapping .training-network')!
      .getBoundingClientRect();
    const paths = compositionPaths({
      input,
      map,
      cor,
      op,
      loss,
      mobile,
      gap,
      readings: {
        left: readings.left - origin.x,
        right: readings.right - origin.x,
        top: readings.top - origin.y,
        bottom: readings.bottom - origin.y,
        width: readings.width,
        height: readings.height,
      },
      network: { top: network.top - origin.top, height: network.height },
    });
    svg.replaceChildren();
    flows = [];
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    paths.forEach(({ d, stage }) => path(d, stage));
  }

  function draw(t: number, beat: ReturnType<typeof trainingBeat>) {
    updateParameters(t, reduced);
    if (beat !== activeBeat) {
      activeBeat = beat;
      signals = trainingSignals(beat);
    }
    for (const f of flows) {
      const range = signals[f.stage];
      const u = (t - range[0]) / (range[1] - range[0]),
        alpha = !reduced && u >= 0 && u <= 1 ? Math.sin(Math.PI * u) : 0;
      f.light.style.opacity = String(alpha * 0.85);
      f.light.setAttribute('stroke-dashoffset', String(-(clamp(u) * (f.length + 24) - 24)));
    }
    for (const { name, layers, edges } of networks) {
      const [from, to] = name === 'mapping' ? signals.mappingScan : signals.correctionScan;
      const u = (t - from) / (to - from);
      layers.forEach((node, i) =>
        node.classList.toggle('is-lit', !reduced && u >= i / 3 && u < (i + 1) / 3),
      );
      edges.forEach(({ element, layer }) => {
        element.classList.toggle(
          'is-lit',
          !reduced && u >= (layer + 0.4) / 3 && u < (layer + 1.4) / 3,
        );
      });
    }
    operations.forEach((n) => {
      const start = n.dataset.module === 'continuous' ? beat.continuous : beat.rounding;
      n.classList.toggle('is-active', !reduced && t >= start && t < start + trainingCadence.action);
      n.classList.toggle(
        'is-settling',
        !reduced &&
          t >= start + trainingCadence.action &&
          t < start + trainingCadence.action + trainingCadence.pulse / 2,
      );
    });
    lossPanel.classList.toggle(
      'is-active',
      !reduced && t >= beat.loss && t < beat.loss + trainingCadence.action,
    );
    lossPanel.classList.toggle(
      'is-settling',
      !reduced &&
        t >= beat.loss + trainingCadence.action &&
        t < beat.loss + trainingCadence.action + trainingCadence.pulse / 2,
    );
  }
  root.addEventListener('l2o:tick', ((event: TrainingTickEvent) =>
    draw(event.detail.t, event.detail.beat)) as EventListener);
  new ResizeObserver(build).observe(root);
  document.fonts.ready.then(build);
});
