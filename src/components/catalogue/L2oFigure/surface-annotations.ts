import { projectSurfacePoint, type SurfaceCamera } from './surface-camera.ts';
import type { Point2, Vector3 } from './surface-model.ts';

/** Constraint labels are static between resizes and use the surface's fitted projection. */
export function createSurfaceAnnotations(
  context: CanvasRenderingContext2D,
  worldPoint: (x: number, y: number, lift?: number) => Vector3,
  b: number,
) {
  function drawLabel(
    text: string,
    position: Point2,
    color = '#a3a7ad',
    align: CanvasTextAlign = 'center',
    size = 11,
  ) {
    // Match the problem's mathematical typeface, including its plain numeral zero.
    context.font = `${size}px Georgia,serif`;
    context.textAlign = align;
    context.textBaseline = 'middle';
    context.lineWidth = 2;
    context.strokeStyle = 'rgba(16,17,19,.35)';
    context.strokeText(text, ...position);
    context.fillStyle = color;
    context.fillText(text, ...position);
  }

  return (camera: SurfaceCamera, compact: boolean, ratio: number) => {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const labels: [string, Vector3, number, number][] = [
      ['x² ≤ b', worldPoint(-Math.sqrt(b), 5.7), -13, -13],
      ['x ≤ 0', worldPoint(0, 5.7), 16, -9],
      // Desktop places this label below the blue/graphite boundary; compact uses its left edge.
      ['y ≥ b/2', worldPoint(compact ? -3 : -0.5, b / 2), compact ? -4 : 0, compact ? 24 : 14],
    ];
    labels.forEach(([text, point, dx, dy]) => {
      const position = projectSurfacePoint(point, camera);
      drawLabel(
        text,
        [position[0] + dx, position[1] + dy],
        '#a3a7ad',
        'center',
        camera.width < 430 ? 10 : 11,
      );
    });
  };
}
