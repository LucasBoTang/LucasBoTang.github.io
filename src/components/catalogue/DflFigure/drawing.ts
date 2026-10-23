import { neon, strokeTube } from './material';

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
  const scale = Math.min(box.width / 280, 0.85);
  ctx.translate(box.width / 2, box.height / 2);
  ctx.scale(scale, scale);
  // Each module uses one scale; reading the matrix for every neon stroke is redundant.
  let strokeScale = 1;
  const refreshStrokeScale = () => {
    const transform = ctx.getTransform();
    strokeScale = Math.hypot(transform.a, transform.b) / dpr;
  };
  refreshStrokeScale();
  const screenStroke = (pixels = 1.05) => pixels / strokeScale;
  // Layer a crisp pale core inside a blue body; bloom stays close to the object.
  function line(from: Point2D, to: Point2D, alpha = 0.25, width = 0.7) {
    const network = canvas.dataset.module === 'predict';
    const structure = network && width === 0.6;
    const strength = Math.max(0, Math.min(1, alpha));
    const pixels = network ? (structure ? 1.5 : 2.3) : width >= 1.3 ? 2.2 + strength * 1.2 : 1.1;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...from);
    ctx.lineTo(...to);
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
  function dot(point: Point2D, baseRadius = 2, alpha = 0.6, glow = 0) {
    if (alpha <= 0.001) return;
    const network = canvas.dataset.module === 'predict';
    const radius = network
      ? screenStroke(3.2) + (baseRadius - 2.2) * 0.7
      : Math.max(baseRadius * 1.12, screenStroke(glow > 1 ? 2.4 : 1.6));
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
    ctx.shadowBlur = 5 + glow * 0.5;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = screenStroke(0.9);
    ctx.strokeStyle = neon.core;
    ctx.stroke();
    ctx.restore();
  }

  return { scale, screenStroke, refreshStrokeScale, line, dot };
}
