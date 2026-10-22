/** Limit a normalized value to the unit interval. */
export function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Cubic easing with zero slope at both endpoints. */
export function smoothstep(value: number): number {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

/** Quintic easing; callers supply a normalized fraction. */
export function smootherstep(t: number): number {
  return t * t * t * (t * (6 * t - 15) + 10);
}

/** Linear interpolation, without clamping or rounding. */
export function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}
