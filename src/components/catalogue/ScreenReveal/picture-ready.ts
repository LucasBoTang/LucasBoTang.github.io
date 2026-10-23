/** Wait for the embedded document and its first painted, fitted picture, not about:blank. */
export async function waitForPicture(frame: HTMLIFrameElement): Promise<void> {
  const loaded = () => {
    const page = frame.contentDocument;
    return page?.readyState === 'complete' && page.URL !== 'about:blank';
  };
  if (!loaded())
    await new Promise<void>((resolve) => {
      const onLoad = () => {
        if (!loaded()) return;
        frame.removeEventListener('load', onLoad);
        resolve();
      };
      frame.addEventListener('load', onLoad);
    });
  const page = frame.contentDocument;
  if (page)
    await Promise.allSettled([
      page.fonts.ready,
      ...[...page.images].map((image) => image.decode()),
    ]);
  // Resize observers fit the canvas before the next paint; a second frame commits that picture.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}
