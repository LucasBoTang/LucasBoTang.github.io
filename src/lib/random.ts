/** Repeatable samples in [0, 1), indexed independently of call order or frame rate. */
export const seeded = (index: number) => {
  const value = Math.sin(index * 91.345 + 47.853) * 43758.5453;
  return value - Math.floor(value);
};
