import { moduleScale } from './geometry';
import { neon, neonMetrics, strokeTube } from './material';

export type Point2D = [number, number];
export interface ModuleSurface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  box: { width: number; height: number };
  formula: HTMLElement | null;
  walkTiming?: { scale: number; durations: number[]; starts: number[] };
}

/** A frame's canvas transform and shared neon drawing vocabulary. */
export type ModuleDrawing = NonNullable<ReturnType<typeof prepareModuleFrame>>;

/** Set up one frame; module renderers retain the same CSS-pixel stroke widths. */
export function prepareModuleFrame(surface: ModuleSurface) {
  const { canvas, ctx, box } = surface;
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
  const scale = moduleScale(box.width);
  const network = canvas.dataset.module === 'predict';
  ctx.translate(box.width / 2, box.height / 2);
  ctx.scale(scale, scale);
  // Each module uses one scale; reading the matrix for every neon stroke is redundant.
  let strokeScale = 1;
  const refreshStrokeScale = () => {
    const transform = ctx.getTransform();
    strokeScale = Math.hypot(transform.a, transform.b) / dpr;
  };
  refreshStrokeScale();
  const screenStroke = (pixels = neonMetrics.axis) => pixels / strokeScale;
  // Layer a crisp pale core inside a blue body; bloom stays close to the object.
  function line(
    from: Point2D,
    to: Point2D,
    alpha = 0.25,
    role: 'structure' | 'signal' | 'axis' = 'axis',
  ) {
    const dense = network && role === 'structure';
    const strength = Math.max(0, Math.min(1, alpha));
    const pixels =
      role === 'structure'
        ? dense
          ? neonMetrics.denseStructure
          : neonMetrics.structure
        : role === 'signal'
          ? neonMetrics.signal
          : neonMetrics.axis;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...from);
    ctx.lineTo(...to);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokeTube(
      ctx,
      screenStroke(pixels),
      dense ? 0.42 : Math.min(1, strength * 2.1),
      !network && role !== 'axis' ? neonMetrics.halo * dpr : 0,
    );
    ctx.restore();
  }
  function dot(point: Point2D, radiusPixels = neonMetrics.nodeRadius, alpha = 0.6, glow = 0) {
    if (alpha <= 0.001) return;
    const radius = screenStroke(radiusPixels);
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha * 1.8);
    ctx.beginPath();
    ctx.arc(...point, radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
      point[0] - radius * 0.3,
      point[1] - radius * 0.4,
      0,
      point[0],
      point[1],
      radius,
    );
    gradient.addColorStop(0, neon.core);
    gradient.addColorStop(0.35, neon.body);
    gradient.addColorStop(1, neon.dim);
    ctx.fillStyle = gradient;
    ctx.shadowColor = neon.halo;
    ctx.shadowBlur = (neonMetrics.halo + glow * 0.5) * dpr;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = screenStroke(neonMetrics.nodeOutline);
    ctx.strokeStyle = neon.core;
    ctx.stroke();
    ctx.restore();
  }

  return { ctx, scale, pixelRatio: dpr, screenStroke, refreshStrokeScale, line, dot };
}
