import {
  add,
  cross,
  dot,
  multiply,
  normalize,
  subtract,
  type Point2,
  type Vector3,
} from './surface-model.ts';

export type SurfaceCamera = {
  right: Vector3;
  up: Vector3;
  forward: Vector3;
  center: Vector3;
  scale: number;
  width: number;
  height: number;
};

type WorldPoint = (x: number, y: number, lift?: number) => Vector3;

/** Share one projection between trajectory distances, the WebGL surface and its labels. */
export function createSurfaceCamera(fitPoints: Vector3[], worldPoint: WorldPoint) {
  const azimuth = -0.76,
    elevation = 0.64;
  const forward: Vector3 = [
    Math.cos(azimuth) * Math.cos(elevation),
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
  ];
  const right = normalize(cross([0, 0, 1], forward));
  const up = normalize(cross(forward, right));

  function fit(width: number, height: number): SurfaceCamera {
    const all = fitPoints.concat([
        worldPoint(-3, -1.3),
        worldPoint(0.5, -1.3),
        worldPoint(0.5, 5.7),
        worldPoint(-3, 5.7),
      ]),
      rx = all.map((p) => dot(p, right)),
      uy = all.map((p) => dot(p, up));
    const minX = Math.min(...rx),
      maxX = Math.max(...rx),
      minY = Math.min(...uy),
      maxY = Math.max(...uy);
    let center = add(multiply(right, (minX + maxX) / 2), multiply(up, (minY + maxY) / 2));
    const scale = Math.min((width - 30) / (maxX - minX), (height - 38) / (maxY - minY));
    // Use the lower-right negative space; keep the surface large on a phone.
    const targetY = 16 + ((maxY - minY) * scale) / 2;
    center = add(
      add(center, multiply(right, 8 / scale)),
      multiply(up, (targetY - height / 2) / scale),
    );
    return { right, up, forward, center, scale, width, height };
  }

  return { right, up, fit };
}

export function projectSurfacePoint(p: Vector3, camera: SurfaceCamera): Point2 {
  const { center, width, height, right, up, scale } = camera;
  const d = subtract(p, center);
  return [width / 2 + dot(d, right) * scale, height / 2 - dot(d, up) * scale];
}
