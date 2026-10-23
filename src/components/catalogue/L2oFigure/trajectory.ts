import { clamp } from '../../../lib/easing.ts';

type Point = [number, number, number];

/** Linear progress keeps the projected reveal and marker at one visible speed. */
export const trajectoryProgress = clamp;
export const trajectoryTime = clamp;

export function trajectoryLengths(points: Point[], project: (point: Point) => [number, number]) {
  const screen = points.map(project);
  const lengths = [0];
  for (let i = 1; i < screen.length; i++)
    lengths.push(
      lengths[i - 1] + Math.hypot(screen[i][0] - screen[i - 1][0], screen[i][1] - screen[i - 1][1]),
    );
  return lengths;
}

export function trajectoryPoint(points: Point[], lengths: number[], progress: number): Point {
  const distance = clamp(progress) * lengths[lengths.length - 1];
  let low = 0,
    high = points.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (lengths[middle] < distance) low = middle;
    else high = middle;
  }
  const span = lengths[high] - lengths[low];
  const fraction = span > 0 ? (distance - lengths[low]) / span : 0;
  return [0, 1, 2].map(
    (axis) => points[low][axis] + (points[high][axis] - points[low][axis]) * fraction,
  ) as Point;
}
