import shapes from '../../../data/research/dfl-polytopes.json';
import { smoothstep as smooth } from '../../../lib/easing.ts';
import { ambientSwing } from './ambient';
import type { ModuleDrawing, ModuleSurface, Point2D } from './drawing';
import { paperRGB, signalRGB } from './ink';
import { flowSpeed, simplexDurations, simplexVertexPause, timing } from './timeline';

/** Render the shared camera, polytope, and timed edge walk as one geometric scene. */
export function drawOptimization(
  surface: ModuleSurface,
  drawing: ModuleDrawing,
  flow: number,
  ambient: number,
) {
  const { canvas, ctx, box, formula } = surface;
  const { scale, screenStroke, refreshStrokeScale, line, dot } = drawing;
  const shape = shapes[Number(canvas.dataset.module!.split('-')[1])],
    vertices = shape.vertices;
  const polyScale = 0.46;
  ctx.translate(7 / scale, 10 / scale);
  ctx.scale(polyScale, polyScale);
  refreshStrokeScale();
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
    const x = box.width / 2 + 7 + anchor[0] * scale * polyScale;
    const y = box.height / 2 + 10 + anchor[1] * scale * polyScale;
    formula!.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) matrix(${Math.cos(yaw)},${Math.sin(yaw) * Math.sin(pitch)},0,${Math.cos(pitch)},0,0)`;
  }
  const projected = vertices.map(project);
  {
    const origin = project([-1.8, 1.6, -1.5]).slice(0, 2) as Point2D;
    const ends = [
      [2.7, 1.6, -1.5],
      [-1.8, -2.3, -1.5],
      [-1.8, 1.6, 2.6],
    ];
    ends.forEach((p) => {
      const end = project(p).slice(0, 2) as Point2D;
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
  const edges = [...shape.edges];
  edges.sort(
    (a, b) => projected[a[0]][2] + projected[a[1]][2] - (projected[b[0]][2] + projected[b[1]][2]),
  );
  // An illustrative edge walk, chosen for a legible silhouette and rhythm.
  const walk = [7, 1, 2, 10, 8]; // Four adjacent, visibly distinct edges on A.
  // Arc-length timing: inherit the entering band's CSS-pixel speed.
  const walkScale = scale * polyScale;
  if (surface.walkTiming?.scale !== walkScale) {
    const durations = simplexDurations(walkScale, flowSpeed);
    const starts = [0];
    durations.forEach((d, k) =>
      starts.push(starts[starts.length - 1] + d + (k < 3 ? simplexVertexPause : 0)),
    );
    surface.walkTiming = { scale: walkScale, durations, starts };
  }
  const { durations, starts } = surface.walkTiming;

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
    smooth((flow - timing.optimization) / 0.12) * (1 - smooth((flow - timing.decision[0]) / 0.24));
  edges.forEach(([i, j]) => {
    const depth = (projected[i][2] + projected[j][2]) / 4;
    line(
      projected[i].slice(0, 2) as Point2D,
      projected[j].slice(0, 2) as Point2D,
      0.34 - depth * 0.28,
      1.35,
    );
  });
  projected.forEach((p) => dot(p.slice(0, 2) as Point2D, 1.35, p[2] < 0 ? 0.62 : 0.22));
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
  const head: Point2D = [from[0] + (to[0] - from[0]) * ease, from[1] + (to[1] - from[1]) * ease];
  const vertexFlash =
    step < 3
      ? Math.sin(Math.PI * Math.max(0, Math.min(1, (local - durations[step]) / simplexVertexPause)))
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
}
