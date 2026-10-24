import { mapInSlices } from './sliced-map.ts';
import { createSurfaceAnnotations } from './surface-annotations.ts';
import { createSurfaceCamera } from './surface-camera.ts';
import {
  appendTube,
  appendVertex,
  createSurfaceModel,
  dot,
  easeOut,
  hexColor,
  normalize,
  objectiveTone,
  paletteColor,
  sphereVertices,
  terrainPalette,
  integerPalette,
  neutralPalette,
  constraintPalette,
  type Point2,
  type SurfaceParameters,
  type Vector3,
} from './surface-model.ts';
import { createSurfaceRenderer } from './surface-webgl.ts';
import { surfaceOpacityAt, trainingCadence, trainingTimeline } from './timing.ts';
import { trajectoryLengths, trajectoryPoint, trajectoryProgress } from './trajectory.ts';

type SurfaceRecording = {
  parameters: SurfaceParameters;
  relaxed: number[][];
  corrected: number[][];
};
type SurfaceFrame = {
  phase: number;
  opacity: number;
  arrivedPoint: number;
  reducedMotion: boolean;
};

interface SurfaceScene {
  readonly timeline: ReturnType<typeof trainingTimeline>;
  resize(): void;
  render(frame: SurfaceFrame): void;
}

/** Build the immutable meshes once. Playback supplies a frame; this scene owns geometry and pixels. */
export async function createSurfaceScene(
  canvas: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
  recorded: SurfaceRecording,
): Promise<SurfaceScene | null> {
  // Separate mesh phases so uploads and construction do not monopolize input.
  const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  // The overlay holds only the constraint labels: drawn on resize, never touched by a frame.
  const labelContext = overlay.getContext('2d')!;
  const gl = canvas.getContext('webgl', {
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
  });
  if (!gl) return null;
  const { a, b } = recorded.parameters;
  const { objective, heightAt, worldPoint, isFeasible } = createSurfaceModel({ a, b });
  const integerPointColor = hexColor('#d9c7ab'),
    ivory = hexColor('#edf4f7');
  const drawAnnotations = createSurfaceAnnotations(labelContext, worldPoint, b);
  const renderer = createSurfaceRenderer(gl, { a, b });
  const { createMesh, drawMesh } = renderer;
  const origin: Vector3 = [0, 0, 0];
  const createPointMesh = (point: Vector3, radius: number, color: Vector3) =>
    createMesh(sphereVertices(point, radius, color), 0.8);
  await yieldToBrowser();
  const xs = [
    ...Array.from({ length: 101 }, (_, i) => -3 + (3.5 * i) / 100),
    -Math.sqrt(b),
    0,
  ].sort((a, b) => a - b);
  const ys = [...Array.from({ length: 141 }, (_, i) => -1.3 + (7 * i) / 140), b / 2].sort(
    (a, b) => a - b,
  );
  // Adjacent triangles share vertices; compute each sample and palette entry once.
  const palettes = [neutralPalette, terrainPalette].map((stops) =>
    Array.from({ length: 16 }, (_, i) => paletteColor(stops, i / 16)),
  );
  const gridSamples = await mapInSlices(ys, (py) =>
    xs.map((px) => {
      const eps = 0.001;
      const dzx = (heightAt(px + eps, py) - heightAt(px - eps, py)) / (2 * eps * 1.3);
      const dzy = (heightAt(px, py + eps) - heightAt(px, py - eps)) / (2 * eps * 0.65);
      return {
        position: worldPoint(px, py),
        normal: normalize([-dzx, -dzy, 1]),
        band: Math.min(15, Math.floor(objectiveTone(objective(px, py)) * 16)),
      };
    }),
  );
  await yieldToBrowser();
  const terrainData: number[] = [],
    fitPoints: Vector3[] = [];
  for (let iy = 0; iy < ys.length - 1; iy++) {
    if (iy > 0 && iy % 8 === 0) await yieldToBrowser();
    for (let ix = 0; ix < xs.length - 1; ix++) {
      const x = (xs[ix] + xs[ix + 1]) / 2,
        y = (ys[iy] + ys[iy + 1]) / 2;
      const palette = palettes[isFeasible(x, y) ? 1 : 0];
      const corners = [
        gridSamples[iy][ix],
        gridSamples[iy][ix + 1],
        gridSamples[iy + 1][ix + 1],
        gridSamples[iy + 1][ix],
      ];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const sample = corners[k];
        appendVertex(terrainData, sample.position, sample.normal, palette[sample.band]);
      }
      if (ix % 4 === 0 && iy % 4 === 0) fitPoints.push(worldPoint(x, y));
    }
  }
  const surface = createMesh(terrainData);
  await yieldToBrowser();
  const guides: number[] = [],
    boundaries: number[] = [];
  for (const y of [-1, 0, 1, 2, 3, 4, 5]) {
    const pts: Vector3[] = [],
      cs: Vector3[] = [];
    for (let i = 0; i <= 220; i++) {
      const x = -3 + (3.5 * i) / 220;
      pts.push(worldPoint(x, y, 0.014));
      cs.push(
        paletteColor(
          isFeasible(x, y) ? integerPalette : constraintPalette,
          objectiveTone(objective(x, y)),
        ),
      );
    }
    appendTube(guides, pts, cs, 0.01);
    await yieldToBrowser();
  }
  for (const x of [-Math.sqrt(b), 0]) {
    const pts = Array.from({ length: 221 }, (_, i) => worldPoint(x, -1.3 + (7 * i) / 220, 0.02));
    appendTube(boundaries, pts, hexColor('#647c91'), 0.005);
    await yieldToBrowser();
  }
  appendTube(
    boundaries,
    Array.from({ length: 221 }, (_, i) => worldPoint(-3 + (3.5 * i) / 220, b / 2, 0.02)),
    hexColor('#647c91'),
    0.005,
  );
  const slices = createMesh(guides, 1),
    constraints = createMesh(boundaries, 1);
  const samples = recorded.relaxed.flatMap((p, i) => [
    p as Point2,
    recorded.corrected[i] as Point2,
  ]);
  const trajectory = {
    pathRadius: 0.018,
    relaxedRadius: 0.07,
    integerRadius: 0.08,
  };
  const camera = createSurfaceCamera(fitPoints, worldPoint);
  const { right, up } = camera;
  const traceData: number[] = [];
  const segments: { points: Vector3[]; lengths: number[] }[] = [];
  for (let i = 1; i < samples.length; i++) {
    const p = samples[i - 1],
      q = samples[i],
      pts: Vector3[] = [];
    for (let j = 0; j <= 100; j++) {
      const fraction = j / 100;
      pts.push(worldPoint(p[0] + (q[0] - p[0]) * fraction, p[1] + (q[1] - p[1]) * fraction, 0.045));
    }
    const lengths = trajectoryLengths(pts, (point) => [dot(point, right), dot(point, up)]);
    segments.push({ points: pts, lengths });
    if (i % 4 === 0) await yieldToBrowser();
  }
  const timeline = trainingTimeline(
    segments.map((segment) => segment.lengths[segment.lengths.length - 1]),
  );
  const { arrivals, speed } = timeline;
  const traceSegments = await mapInSlices(segments, (segment, i) => {
    const from = arrivals[i],
      to = arrivals[i + 1];
    const times = segment.lengths.map((length) => from + length / speed);
    appendTube(traceData, segment.points, ivory, trajectory.pathRadius, times);
    return { ...segment, from, to };
  });
  const trace = createMesh(traceData, 1);
  await yieldToBrowser();
  const pointMeshes = await mapInSlices(samples, (p, i) =>
    createPointMesh(
      worldPoint(...p, 0.075),
      i % 2 ? trajectory.integerRadius : trajectory.relaxedRadius,
      i % 2 ? integerPointColor : ivory,
    ),
  );
  let width = 600,
    height = 500,
    ratio = 1,
    compact = false;
  const movingHead = createPointMesh(origin, trajectory.integerRadius * 0.9, ivory);
  function resize() {
    compact = canvas.closest('.l2o-material')!.clientWidth <= 560;
    const r = canvas.getBoundingClientRect();
    width = r.width;
    height = r.height;
    ratio = Math.min(devicePixelRatio || 1, 2);
    for (const c of [canvas, overlay]) {
      const resolution = c === canvas ? Math.min(ratio, 1.5) : ratio;
      c.width = Math.round(width * resolution);
      c.height = Math.round(height * resolution);
    }
    renderer.resizeViewport(canvas.width, canvas.height);
    const fittedCamera = camera.fit(width, height);
    renderer.setCamera(fittedCamera);
    drawAnnotations(fittedCamera, compact, ratio);
  }
  function render({ phase, opacity: fade, arrivedPoint, reducedMotion }: SurfaceFrame) {
    renderer.beginFrame();
    drawMesh(surface, phase, surfaceOpacityAt(phase, timeline.cycle, reducedMotion, compact));
    drawMesh(slices, phase);
    drawMesh(constraints, phase);
    drawMesh(trace, phase, fade);
    pointMeshes.forEach((m, i) => {
      if (i <= arrivedPoint)
        drawMesh(m, phase, fade * easeOut((phase - arrivals[i]) / trainingCadence.point));
    });
    const travelling = traceSegments.find((segment) => phase >= segment.from && phase < segment.to);
    if (travelling && !reducedMotion) {
      const progress = trajectoryProgress(
        (phase - travelling.from) / (travelling.to - travelling.from),
      );
      drawMesh(
        movingHead,
        phase,
        fade,
        trajectoryPoint(travelling.points, travelling.lengths, progress),
      );
    }
  }
  return { timeline, resize, render };
}
