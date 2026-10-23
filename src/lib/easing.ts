/** Limit a normalized value to the unit interval. */
export function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Cubic easing with zero slope at both endpoints. */
export function smoothstep(value: number): number {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}
