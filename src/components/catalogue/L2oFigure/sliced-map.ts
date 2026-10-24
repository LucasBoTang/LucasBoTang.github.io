const SLICE_BUDGET_MS = 4;

/** Preserve order while giving input and painting a turn between construction slices. */
export async function mapInSlices<T, R>(
  items: readonly T[],
  map: (item: T, index: number) => R,
): Promise<R[]> {
  const result: R[] = [];
  let startedAt = performance.now();
  for (let index = 0; index < items.length; index++) {
    if (index && performance.now() - startedAt >= SLICE_BUDGET_MS) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      startedAt = performance.now();
    }
    result.push(map(items[index], index));
  }
  return result;
}
