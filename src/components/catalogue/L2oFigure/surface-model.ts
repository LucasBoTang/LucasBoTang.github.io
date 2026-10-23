import { clamp } from '../../../lib/easing.ts';

/** Pure geometry and color math for the recorded Rosenbrock surface; no browser state. */
export type Vector3 = [number, number, number];
export type Point2 = [number, number];
export type SurfaceParameters = { a: number; b: number };

export const easeOut = (t: number) => 1 - (1 - clamp(t)) ** 3;
export const subtract = (a: Vector3, b: Vector3): Vector3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const add = (a: Vector3, b: Vector3): Vector3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const multiply = (a: Vector3, t: number): Vector3 => [a[0] * t, a[1] * t, a[2] * t];
export const dot = (a: Vector3, b: Vector3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vector3, b: Vector3): Vector3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const normalize = (a: Vector3): Vector3 => multiply(a, 1 / (Math.hypot(...a) || 1));

/** Map optimization coordinates into the approved compressed-height surface. */
export function createSurfaceModel({ a, b }: SurfaceParameters) {
  const objective = (x: number, y: number) => (a - x) ** 2 + 50 * (y - x * x) ** 2;
  const heightAt = (x: number, y: number) =>
    0.24 + (Math.log1p(objective(x, y)) / Math.log(5001)) * 2.15;
  const worldPoint = (x: number, y: number, lift = 0): Vector3 => [
    (x + 1.25) * 1.3,
    (y - 2.2) * 0.65,
    heightAt(x, y) + lift,
  ];
  const isFeasible = (x: number, y: number) =>
    x >= -Math.sqrt(b) - 1e-7 && x <= 1e-7 && y >= b / 2 - 1e-7;
  return { objective, heightAt, worldPoint, isFeasible };
}

export const hexColor = (s: string): Vector3 => [
  parseInt(s.slice(1, 3), 16) / 255,
  parseInt(s.slice(3, 5), 16) / 255,
  parseInt(s.slice(5, 7), 16) / 255,
];
type ColorStop = [number, string];
// Continuous cool objective-height gradient; warm accents belong only to integer sections.
export const terrainPalette: ColorStop[] = [
  [0, '#263b64'],
  [0.28, '#3c70a2'],
  [0.48, '#3e9eb2'],
  [0.65, '#78beb7'],
  [0.8, '#8fbdc4'],
  [1, '#a8cbd4'],
];
// Restore the established, more chromatic integer-section palette.
export const integerPalette: ColorStop[] = [
  [0, '#4c83c8'],
  [0.3, '#31a7c6'],
  [0.58, '#31c895'],
  [0.79, '#b1d976'],
  [1, '#f0d657'],
];
export const neutralPalette: ColorStop[] = [
  [0, '#1b2537'],
  [0.3, '#304455'],
  [0.58, '#455f69'],
  [0.79, '#627a88'],
  [1, '#889ca8'],
];
export const constraintPalette: ColorStop[] = [
  [0, '#303e4d'],
  [0.3, '#3e5062'],
  [0.58, '#526779'],
  [0.79, '#6d8395'],
  [1, '#94a7b5'],
];
// Interpolate perceptually so the hue changes remain continuous.
function toOklab(c: Vector3): Vector3 {
  const l = c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = Math.cbrt(0.4122214708 * l[0] + 0.5363325363 * l[1] + 0.0514459929 * l[2]),
    M = Math.cbrt(0.2119034982 * l[0] + 0.6806995451 * l[1] + 0.1073969566 * l[2]),
    S = Math.cbrt(0.0883024619 * l[0] + 0.2817188376 * l[1] + 0.6299787005 * l[2]);
  return [
    0.2104542553 * L + 0.793617785 * M - 0.0040720468 * S,
    1.9779984951 * L - 2.428592205 * M + 0.4505937099 * S,
    0.0259040371 * L + 0.7827717662 * M - 0.808675766 * S,
  ];
}
function fromOklab(c: Vector3): Vector3 {
  const L = (c[0] + 0.3963377774 * c[1] + 0.2158037573 * c[2]) ** 3,
    M = (c[0] - 0.1055613458 * c[1] - 0.0638541728 * c[2]) ** 3,
    S = (c[0] - 0.0894841775 * c[1] - 1.291485548 * c[2]) ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ].map((v) =>
    clamp(v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055),
  ) as Vector3;
}
const labs = new Map<string, Vector3>();
export function paletteColor(stops: ColorStop[], t: number): Vector3 {
  t = clamp(t);
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const p = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
  const get = (s: string) => {
    if (!labs.has(s)) labs.set(s, toOklab(hexColor(s)));
    return labs.get(s)!;
  };
  return fromOklab(add(multiply(get(stops[i][1]), 1 - p), multiply(get(stops[i + 1][1]), p)));
}
export const objectiveTone = (v: number) =>
  clamp(Math.log(3200 / Math.max(12, v)) / Math.log(3200 / 12));

export function appendVertex(data: number[], p: Vector3, n: Vector3, c: Vector3, t = -100) {
  data.push(...p, ...n, ...c, t);
}

export function appendTube(
  data: number[],
  pts: Vector3[],
  colors: Vector3 | Vector3[],
  radius: number,
  times?: number[],
) {
  for (let j = 0; j < pts.length - 1; j++) {
    const p = pts[j],
      q = pts[j + 1],
      dir = normalize(subtract(q, p)),
      axis = Math.abs(dir[2]) > 0.9 ? ([1, 0, 0] as Vector3) : ([0, 0, 1] as Vector3),
      ex = normalize(cross(dir, axis)),
      ey = normalize(cross(dir, ex));
    for (let k = 0; k < 6; k++) {
      const n1 = add(
          multiply(ex, Math.cos((k * Math.PI) / 3)),
          multiply(ey, Math.sin((k * Math.PI) / 3)),
        ),
        n2 = add(
          multiply(ex, Math.cos(((k + 1) * Math.PI) / 3)),
          multiply(ey, Math.sin(((k + 1) * Math.PI) / 3)),
        );
      const c1 = Array.isArray(colors[0]) ? (colors as Vector3[])[j] : (colors as Vector3),
        c2 = Array.isArray(colors[0]) ? (colors as Vector3[])[j + 1] : (colors as Vector3);
      for (const [point, n, c, t] of [
        [p, n1, c1, times?.[j] ?? -100],
        [q, n1, c2, times?.[j + 1] ?? -100],
        [p, n2, c1, times?.[j] ?? -100],
        [p, n2, c1, times?.[j] ?? -100],
        [q, n1, c2, times?.[j + 1] ?? -100],
        [q, n2, c2, times?.[j + 1] ?? -100],
      ] as [Vector3, Vector3, Vector3, number][])
        appendVertex(data, add(point, multiply(n, radius)), n, c, t);
    }
  }
}

export function sphereVertices(p: Vector3, r: number, c: Vector3) {
  const data: number[] = [];
  for (let a = 0; a < 10; a++)
    for (let b = 0; b < 16; b++) {
      const v = (i: number, j: number): Vector3 => [
        Math.sin((i * Math.PI) / 10) * Math.cos((j * Math.PI) / 8),
        Math.sin((i * Math.PI) / 10) * Math.sin((j * Math.PI) / 8),
        Math.cos((i * Math.PI) / 10),
      ];
      for (const [i, j] of [
        [a, b],
        [a + 1, b],
        [a + 1, b + 1],
        [a, b],
        [a + 1, b + 1],
        [a, b + 1],
      ]) {
        const n = v(i, j);
        appendVertex(data, add(p, multiply(n, r)), n, c);
      }
    }
  return data;
}
