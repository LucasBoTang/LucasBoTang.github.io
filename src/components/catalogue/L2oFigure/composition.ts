import { enhance } from '../../../lib/lifecycle';
import { reducedMotionQuery } from '../../../lib/motion';
import { trainingBeat, trainingCadence, trainingSignals } from './timing';

const NS = 'http://www.w3.org/2000/svg';
enhance<HTMLElement>('[data-l2o-material] [data-training-composition]', (root) => {
  const svg = root.querySelector<SVGSVGElement>('.training-connections')!;
  const motionPreference = reducedMotionQuery();
  let reduced = motionPreference.matches;
  motionPreference.addEventListener('change', () => {
    reduced = motionPreference.matches;
  });

  type SignalStage = 'mapping' | 'correction' | 'update' | 'loss';
  let flows: { light: SVGPathElement; length: number; stage: SignalStage }[] = [];
  const operations = Array.from(root.querySelectorAll<HTMLElement>('.operation'));
  const lossPanel = root.querySelector<HTMLElement>('[data-module="loss"]')!;
  root.style.setProperty('--l2o-action-duration', `${trainingCadence.action}s`);
  root.style.setProperty('--l2o-pulse-duration', `${trainingCadence.pulse}s`);
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
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
    svg.append(light);
    flows.push({ light, length, stage });
  }
  function build() {
    svg.replaceChildren();
    flows = [];
    const w = root.clientWidth,
      h = root.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const input = box('parameters'),
      map = box('mapping'),
      cor = box('correction'),
      op = box('operations'),
      loss = box('loss'),
      mobile = w <= 560,
      gap = 7;
    const readings = root.querySelector<HTMLElement>('.parameter-values')!.getBoundingClientRect(),
      origin = root.getBoundingClientRect();
    const forkX = readings.right - origin.x + 7,
      forkY = readings.top - origin.y + readings.height / 2;
    const network = root
      .querySelector<SVGSVGElement>('.mapping .training-network')!
      .getBoundingClientRect();
    const connectionY = network.top - origin.top + network.height / 2;
    if (mobile) {
      const branchY = map.y - 18;
      const inputCenter = readings.left - origin.x + readings.width / 2;
      const inputBottom = readings.bottom - origin.y + 6;
      const halfLink = 7;
      path(`M${inputCenter} ${inputBottom}V${branchY}H${map.cx}V${map.y - 4}`, 'mapping');
      path(`M${inputCenter} ${branchY}H${cor.cx}V${cor.y - 4}`, 'correction');
      const horizontalCenter = (map.x + map.w + cor.x) / 2;
      const updateCenter = (cor.y + cor.h + op.y) / 2;
      const lossCenter = (op.y + op.h + loss.y) / 2;
      path(
        `M${horizontalCenter - halfLink} ${connectionY}H${horizontalCenter + halfLink}`,
        'correction',
      );
      path(`M${op.cx} ${updateCenter - halfLink}V${updateCenter + halfLink}`, 'update');
      path(`M${op.cx} ${lossCenter - halfLink}V${lossCenter + halfLink}`, 'loss');
    } else {
      path(`M${map.cx} ${input.y + input.h + gap}V${map.y - gap}`, 'mapping');
      path(`M${forkX} ${forkY}H${cor.cx}V${cor.y - gap}`, 'correction');
      path(`M${map.x + map.w + gap} ${connectionY}H${cor.x - gap}`, 'correction');
      path(`M${cor.x + cor.w + gap} ${connectionY}H${op.x - gap}`, 'update');
      path(`M${op.cx} ${op.y + op.h + 3}V${loss.y - 3}`, 'loss');
    }
  }
  function draw(t: number, beat: ReturnType<typeof trainingBeat>) {
    const signals = trainingSignals(beat);
    for (const f of flows) {
      const range = signals[f.stage];
      const u = (t - range[0]) / (range[1] - range[0]),
        alpha = !reduced && u >= 0 && u <= 1 ? Math.sin(Math.PI * u) : 0;
      f.light.style.opacity = String(alpha * 0.85);
      f.light.setAttribute('stroke-dasharray', `${Math.min(24, f.length * 0.55)} ${f.length + 40}`);
      f.light.setAttribute('stroke-dashoffset', String(-(clamp(u) * (f.length + 24) - 24)));
    }
    for (const [name, from, to] of [
      ['mapping', ...signals.mappingScan],
      ['correction', ...signals.correctionScan],
    ] as const) {
      const module = root.querySelector<HTMLElement>(`[data-module="${name}"]`)!;
      const u = (t - from) / (to - from);
      module
        .querySelectorAll('[data-layer]')
        .forEach((n, i) => n.classList.toggle('is-lit', !reduced && u >= i / 3 && u < (i + 1) / 3));
      module.querySelectorAll('[data-layer-edge]').forEach((n) => {
        const i = Number(n.getAttribute('data-layer-edge'));
        n.classList.toggle('is-lit', !reduced && u >= (i + 0.4) / 3 && u < (i + 1.4) / 3);
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
  root.addEventListener('l2o:tick', ((event: CustomEvent) =>
    draw(event.detail.t, event.detail.beat)) as EventListener);
  const focus = (kind: string | null) =>
    root.dispatchEvent(new CustomEvent('l2o:focus', { detail: { kind } }));
  root.querySelectorAll<HTMLElement>('[data-focus-kind]').forEach((n) => {
    n.addEventListener('mouseenter', () => focus(n.dataset.focusKind!));
    n.addEventListener('mouseleave', () => focus(null));
    n.addEventListener('focus', () => focus(n.dataset.focusKind!));
    n.addEventListener('blur', () => focus(null));
    n.addEventListener('click', () => focus(n.dataset.focusKind!));
  });

  new ResizeObserver(build).observe(root);
  document.fonts.ready.then(build);
});
