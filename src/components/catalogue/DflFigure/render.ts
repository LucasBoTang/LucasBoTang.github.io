import shapes from '../../../data/research/dfl-polytopes.json';
import { createLoop } from '../../../lib/loop';
import { watchActivity } from '../../../lib/motion';
import { ambientSwing, updateDatasetAmbient } from './ambient';
import { drawDecisionBalance } from './balance';
import { paperRGB, signalRGB } from './ink';
import { neon, strokeTube } from './material';

import {
  timing,
  flowPhase,
  smooth,
  simplexDurations,
  simplexVertexPause,
  neuralLayerPause,
  flowSpeed,
} from './timeline';
import { updateDflFlow } from './flow-layout';
type P = [number, number];
const wake = (age: number) => {
  if (age <= 0) return 0;
  const u = Math.min(1, age / 0.09);
  return u * u * (3 - 2 * u) * Math.exp(-Math.pow(Math.max(0, age - 0.09) / 0.28, 2));
};
interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  box: { width: number; height: number };
  formula: HTMLElement | null;
}
function render(surface: Surface, t: number, ambient: number) {
  const { canvas, ctx, box, formula } = surface;
  if (!box.width || !box.height) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (
    canvas.width !== Math.round(box.width * dpr) ||
    canvas.height !== Math.round(box.height * dpr)
  ) {
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, box.width, box.height);
  const scale = Math.min(box.width / 280, 0.85);
  ctx.translate(box.width / 2, box.height / 2);
  ctx.scale(scale, scale);
  const screenStroke = (pixels = 1.05) =>
    pixels / (Math.hypot(ctx.getTransform().a, ctx.getTransform().b) / dpr);
  // Layer a crisp pale core inside a blue body; bloom stays close to the object.
  function line(a: P, b: P, alpha = 0.25, width = 0.7) {
    const network = canvas.dataset.module === 'predict';
    const structure = network && width === 0.6;
    const strength = Math.max(0, Math.min(1, alpha));
    const pixels = network ? (structure ? 1.5 : 2.3) : width >= 1.3 ? 2.2 + strength * 1.2 : 1.1;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokeTube(
      ctx,
      screenStroke(pixels),
      structure ? 0.48 : Math.min(1, strength * 2.1),
      !structure && width >= 1.3,
    );
    ctx.restore();
  }
  function dot(p: P, r = 2, a = 0.6, glow = 0) {
    if (a <= 0.001) return;
    const network = canvas.dataset.module === 'predict';
    const radius = network
      ? screenStroke(3.2) + (r - 2.2) * 0.7
      : Math.max(r * 1.12, screenStroke(glow > 1 ? 2.4 : 1.6));
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 1.8);
    ctx.beginPath();
    ctx.arc(...p, radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
      p[0] - radius * 0.3,
      p[1] - radius * 0.4,
      0,
      p[0],
      p[1],
      radius,
    );
    gradient.addColorStop(0, neon.core);
    gradient.addColorStop(0.35, neon.body);
    gradient.addColorStop(1, neon.dim);
    ctx.fillStyle = gradient;
    ctx.shadowColor = neon.halo;
    ctx.shadowBlur = 5 + glow * 0.5;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = screenStroke(0.9);
    ctx.strokeStyle = neon.core;
    ctx.stroke();
    ctx.restore();
  }
  const flow = flowPhase(t);
  if (canvas.dataset.module === 'predict') {
    const yaw = 0.32 + ambientSwing(ambient, 0.22) * 0.18,
      pitch = 0.1 + ambientSwing(ambient, 0.22 + Math.PI / 2) * 0.065;
    const counts = [3, 5, 5, 3],
      layers: P[][] = counts.map((n, k) =>
        Array.from({ length: n }, (_, j) => {
          const x = -108 + k * 72,
            y = (j - (n - 1) / 2) * 32 * 1.2;
          const z = Math.sin(k * 1.7 + j * 0.9) * 16;
          const depth = -x * Math.sin(yaw) + z * Math.cos(yaw);
          return [
            x * Math.cos(yaw) + z * Math.sin(yaw),
            y * Math.cos(pitch) - depth * Math.sin(pitch),
          ] as P;
        }),
      );
    layers.slice(0, -1).forEach((layer, k) =>
      layer.forEach((a, j) =>
        layers[k + 1].forEach((b, l) => {
          line(a, b, 0.28, 0.6);
          // Light travels along each connection in the actual direction of the pass.
          const forward =
            (flow - timing.neural - k * (timing.neuralStep + neuralLayerPause) - neuralLayerPause) /
            timing.neuralStep;
          const backward =
            (flow -
              timing.reverse -
              (2 - k) * (timing.neuralStep + neuralLayerPause) -
              neuralLayerPause) /
            timing.neuralStep;
          for (let s = 0; s < 16; s++) {
            const u = (s + 0.5) / 16;
            const active = Math.max(wake(forward - u), wake(backward - (1 - u)));
            if (active > 0.01)
              line(
                [a[0] + ((b[0] - a[0]) * s) / 16, a[1] + ((b[1] - a[1]) * s) / 16],
                [a[0] + ((b[0] - a[0]) * (s + 1)) / 16, a[1] + ((b[1] - a[1]) * (s + 1)) / 16],
                active * (0.28 + ((j * 3 + l) % 4) * 0.06),
                0.8,
              );
          }
        }),
      ),
    );
    layers.forEach((layer, k) =>
      layer.forEach((p) => {
        const forwardArrival = timing.neural + k * (timing.neuralStep + neuralLayerPause),
          reverseArrival = timing.reverse + (3 - k) * (timing.neuralStep + neuralLayerPause);
        const layerFlash = (age: number) =>
          smooth(age / 0.06) * (1 - smooth((age - neuralLayerPause) / 0.16));
        const active = Math.max(
          layerFlash(flow - forwardArrival),
          layerFlash(flow - reverseArrival),
        );
        dot(p, 2.2 + active * 0.65, 0.45 + active * 0.55, active * 8);
      }),
    );
  } else if (canvas.dataset.module?.startsWith('optimize')) {
    const shape = shapes[Number(canvas.dataset.module.split('-')[1])],
      vertices = shape.vertices;
    const polyScale = 0.46;
    ctx.translate(7 / scale, 10 / scale);
    ctx.scale(polyScale, polyScale);
    const smooth = (x: number) => {
      const u = Math.max(0, Math.min(1, x));
      return u * u * (3 - 2 * u);
    };
    // Ambient rotation has its own continuous period, independent of the training signal.
    // Only the highlighted edge walk below uses the training cycle.
    const turn = (1 + ambientSwing(ambient, 0.44)) / 2;
    const yaw = 0.24 + turn * 0.36,
      pitch = 0.22 + ambientSwing(ambient, 0.44 + Math.PI / 2) * 0.055;
    // Geometry and coordinate frame share the exact same 3D camera and scale.
    const project = ([x, y, z]: number[]) => {
      const u = x * Math.cos(yaw) + z * Math.sin(yaw),
        v = -x * Math.sin(yaw) + z * Math.cos(yaw);
      return [
        u * 68,
        (y * Math.cos(pitch) - v * Math.sin(pitch)) * 68,
        v * Math.cos(pitch) + y * Math.sin(pitch),
      ];
    };
    {
      const anchor = project([-0.15, -2.12, 0]);
      formula!.style.left = `${box.width / 2 + 7 + anchor[0] * scale * polyScale}px`;
      formula!.style.top = `${box.height / 2 + 10 + anchor[1] * scale * polyScale}px`;
      formula!.style.transform = `translate(-50%,-50%) matrix(${Math.cos(yaw)},${Math.sin(yaw) * Math.sin(pitch)},0,${Math.cos(pitch)},0,0)`;
    }
    const projected = vertices.map(project);
    {
      const origin = project([-1.8, 1.6, -1.5]).slice(0, 2) as P;
      const ends = [
        [2.7, 1.6, -1.5],
        [-1.8, -2.3, -1.5],
        [-1.8, 1.6, 2.6],
      ];
      ends.forEach((p) => {
        const end = project(p).slice(0, 2) as P;
        line(origin, end, 0.31, 1.05);
        const angle = Math.atan2(end[1] - origin[1], end[0] - origin[0]);
        for (const side of [-1, 1])
          line(
            end,
            [end[0] - 7 * Math.cos(angle + side * 0.4), end[1] - 7 * Math.sin(angle + side * 0.4)],
            0.4,
            1.05,
          );
      });
    }
    {
      const faces = [
        [6, 9, 8, 0, 5, 3],
        [11, 10, 8, 9],
        [7, 1, 4, 3, 6],
        [11, 7, 1, 2, 10],
        [10, 8, 0, 2],
        [5, 3, 4],
        [11, 9, 6, 7],
        [2, 0, 5, 4, 1],
      ];
      faces.sort(
        (a, b) =>
          b.reduce((s, i) => s + projected[i][2], 0) / b.length -
          a.reduce((s, i) => s + projected[i][2], 0) / a.length,
      );
      ctx.save();
      const glass = ctx.createLinearGradient(-85, -90, 90, 90);
      glass.addColorStop(0, 'rgba(125,159,201,.12)');
      glass.addColorStop(0.6, 'rgba(125,159,201,.04)');
      glass.addColorStop(1, 'rgba(125,159,201,.015)');
      ctx.fillStyle = glass;
      faces.forEach((face) => {
        ctx.beginPath();
        face.forEach((i, j) =>
          j
            ? ctx.lineTo(projected[i][0], projected[i][1])
            : ctx.moveTo(projected[i][0], projected[i][1]),
        );
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();
    }
    const edges = shape.edges.map((e) => [...e]);
    edges.sort(
      (a, b) => projected[a[0]][2] + projected[a[1]][2] - (projected[b[0]][2] + projected[b[1]][2]),
    );
    // An illustrative edge walk, chosen for a legible silhouette and rhythm.
    const walk = [7, 1, 2, 10, 8]; // Four adjacent, visibly distinct edges on A.
    // Arc-length timing: inherit the entering band's CSS-pixel speed.
    const bandSpeed = flowSpeed;
    const durations = simplexDurations(scale * polyScale, bandSpeed);
    const starts = [0];
    durations.forEach((d, k) =>
      starts.push(starts[starts.length - 1] + d + (k < 3 ? simplexVertexPause : 0)),
    );

    const vertexPause = 0;
    const travelEase = (u: number) => {
      const v = Math.max(0, Math.min(1, u));
      return v;
    };
    const position = Math.max(0, flow - timing.optimization);
    const step = Math.min(4, durations.filter((_, k) => position >= starts[k + 1]).length);
    const local = position - starts[step],
      raw = Math.max(0, Math.min(1, (local - vertexPause) / (durations[step] || 1))),
      ease = travelEase(raw);
    const visibility =
      smooth((flow - timing.optimization) / 0.12) *
      (1 - smooth((flow - timing.decision[0]) / 0.24));
    edges.forEach(([i, j]) => {
      const depth = (projected[i][2] + projected[j][2]) / 4;
      line(projected[i].slice(0, 2) as P, projected[j].slice(0, 2) as P, 0.34 - depth * 0.28, 1.35);
    });
    projected.forEach((p) => dot(p.slice(0, 2) as P, 1.35, p[2] < 0 ? 0.62 : 0.22));
    // One screen-space sweep across the whole solid on the return pass.
    // Reuse the caption's complete interval; rotation continues on ambient time.
    if (flow >= timing.reverseOptimization[0] && flow <= timing.reverseOptimization[1]) {
      const u =
        (flow - timing.reverseOptimization[0]) /
        (timing.reverseOptimization[1] - timing.reverseOptimization[0]);
      const left = Math.min(...projected.map((p) => p[0])),
        right = Math.max(...projected.map((p) => p[0]));
      const radius = (right - left) * 0.22,
        head = right + radius - u * (right - left + 2 * radius);
      const light = ctx.createLinearGradient(head - radius, 0, head + radius, 0);
      light.addColorStop(0, `rgba(${paperRGB},0)`);
      light.addColorStop(0.5, `rgba(${paperRGB},.95)`);
      light.addColorStop(1, `rgba(${paperRGB},0)`);
      ctx.save();
      ctx.strokeStyle = light;
      ctx.fillStyle = light;
      ctx.lineWidth = screenStroke(1.15);
      ctx.beginPath();
      edges.forEach(([i, j]) => {
        ctx.moveTo(projected[i][0], projected[i][1]);
        ctx.lineTo(projected[j][0], projected[j][1]);
      });
      ctx.stroke();
      projected.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.65, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
    // Each passed segment fades independently, leaving only a short luminous wake.
    const tailSeconds = 0.32;
    for (let k = 0; k < walk.length - 1; k++) {
      const a = projected[walk[k]],
        b = projected[walk[k + 1]];
      const segmentDuration = durations[k];
      const elapsed = position - starts[k] - vertexPause;
      if (visibility < 0.001 || elapsed < 0 || elapsed > segmentDuration + tailSeconds) continue;
      const progress = travelEase(elapsed / segmentDuration);
      for (let j = 0; j < 36; j++) {
        const u0 = j / 36,
          u1 = (j + 1) / 36;
        if (u0 >= progress) break;
        const end = Math.min(u1, progress);
        // Invert the easing curve to recover when this piece was traversed.
        const age = elapsed - ((u0 + end) / 2) * segmentDuration;
        const alpha = 0.8 * (1 - smooth(age / tailSeconds)) * visibility;
        if (alpha > 0)
          line(
            [a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0],
            [a[0] + (b[0] - a[0]) * end, a[1] + (b[1] - a[1]) * end],
            alpha,
            1.15,
          );
      }
    }
    const from = projected[walk[step]],
      to = projected[walk[Math.min(step + 1, walk.length - 1)]];
    const head: P = [from[0] + (to[0] - from[0]) * ease, from[1] + (to[1] - from[1]) * ease];
    const vertexFlash =
      step < 3
        ? Math.sin(
            Math.PI * Math.max(0, Math.min(1, (local - durations[step]) / simplexVertexPause)),
          )
        : 0;
    dot(head, 2.7 + vertexFlash * 1.6, visibility, visibility * (9 + vertexFlash * 10));
    if (step === walk.length - 1) {
      const flash = Math.sin(Math.PI * Math.min(1, Math.max(0, (position - starts[4]) / 0.48)));
      ctx.beginPath();
      ctx.arc(head[0], head[1], 6 + flash * 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${signalRGB},${visibility * flash * 0.65})`;
      ctx.lineWidth = screenStroke();
      ctx.stroke();
    }
  } else {
    let sweep: number | null = null;
    if (flow >= timing.evaluation && flow < timing.evaluation + 0.6)
      sweep = (flow - timing.evaluation) / 0.6;
    if (flow >= timing.backward[0] - 0.6 && flow < timing.backward[0])
      sweep = 1 - (flow - (timing.backward[0] - 0.6)) / 0.6;
    drawDecisionBalance(ctx, ambient, sweep, screenStroke(2.4));
  }
}

// One clock drives every module and wire. Geometry is measured only on resize.
const root = document.querySelector<HTMLElement>('.dfl-composition');
if (root) {
  const surfaces = Array.from(root.querySelectorAll<HTMLCanvasElement>('canvas')).flatMap(
    (canvas) => {
      const ctx = canvas.getContext('2d');
      return ctx
        ? [
            {
              canvas,
              ctx,
              box: { width: 0, height: 0 },
              formula: canvas.parentElement!.querySelector<HTMLElement>('.opt-formula'),
            },
          ]
        : [];
    },
  );
  let reduced = false;
  const draw = (elapsed: number) => {
    const time = reduced ? 0 : elapsed / 1000;
    surfaces.forEach((surface) => render(surface, time, time));
    updateDatasetAmbient(root, time);
    updateDflFlow(time, reduced);
  };
  const loop = createLoop(draw);
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const surface = surfaces.find((item) => item.canvas === entry.target)!;
      surface.box = { width: entry.contentRect.width, height: entry.contentRect.height };
    }
    draw(loop.elapsed);
  });
  surfaces.forEach(({ canvas }) => observer.observe(canvas));
  root.addEventListener('dfl:layout', () => draw(loop.elapsed));
  watchActivity(root, ({ inView, hidden, reduced: preference }) => {
    reduced = preference;
    if (inView.has(root) && !hidden && !reduced) loop.start();
    else loop.stop();
    draw(loop.elapsed);
  });
}
