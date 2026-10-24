/** Recheck after idle delivery: input or visibility may have changed while queued. */
export async function waitForIdleWindow(isQuiet: () => boolean): Promise<void> {
  for (;;) {
    if (!isQuiet()) {
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
      continue;
    }
    await new Promise<void>((resolve) =>
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(() => resolve(), { timeout: 1000 })
        : setTimeout(resolve, 0),
    );
    if (isQuiet()) return;
  }
}
