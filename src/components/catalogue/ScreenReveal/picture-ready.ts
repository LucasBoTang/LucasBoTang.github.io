/** Owns a document/resource wait and its two paint frames; cancel releases all pending work. */
export function preparePicture(frame: HTMLIFrameElement) {
  let cancel!: () => void;
  const ready = new Promise<void>((resolve) => {
    let done = false;
    let paint = 0;
    cancel = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(paint);
      frame.onload = frame.onerror = null;
      resolve();
    };
    const loaded = () => {
      if (done) return;
      try {
        const page = frame.contentDocument;
        if (!page) return cancel();
        if (page.URL === 'about:blank' || page.readyState !== 'complete') return;
        frame.onload = null;
        void Promise.allSettled([
          page.fonts.ready,
          ...[...page.images].map((image) => image.decode()),
        ]).then(() => {
          if (done) return;
          // Fit on the first frame; the second commits the fitted picture.
          paint = requestAnimationFrame(() => {
            paint = requestAnimationFrame(cancel);
          });
        });
      } catch {
        cancel();
      }
    };
    // One ScreenReveal owns this frame; property handlers are released together.
    frame.onload = loaded;
    frame.onerror = cancel;
    loaded();
  });
  return { ready, cancel };
}

/** Either a decoded poster or a drawn live figure can release the entrance; cancellation stays bounded. */
export function preparePoster(image: HTMLImageElement, liveHost?: Element | null) {
  let cancel!: () => void;
  const ready = new Promise<void>((resolve) => {
    let observer: MutationObserver | undefined;
    const finish = () => {
      observer?.disconnect();
      resolve();
    };
    cancel = finish;
    if (liveHost?.hasAttribute('data-figure-live')) return finish();
    if (liveHost) {
      observer = new MutationObserver(() => {
        if (liveHost.hasAttribute('data-figure-live')) finish();
      });
      observer.observe(liveHost, { attributes: true, attributeFilter: ['data-figure-live'] });
    }
    void image.decode().then(finish, finish);
  });
  return { ready, cancel };
}
