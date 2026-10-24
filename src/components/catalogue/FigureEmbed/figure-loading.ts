/** Load expensive figure documents shortly before they enter the viewport. */
export function loadFigureEmbeds(
  frames: Iterable<HTMLIFrameElement>,
  Observer: typeof IntersectionObserver | undefined,
) {
  const load = (frame: HTMLIFrameElement) => {
    const src = frame.dataset.figureSrc;
    if (!src) return;
    frame.loading = 'eager';
    frame.src = src;
    delete frame.dataset.figureSrc;
  };
  if (!Observer) {
    for (const frame of frames) load(frame);
    return;
  }
  const observer = new Observer(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        load(entry.target as HTMLIFrameElement);
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '240px 0px' },
  );
  for (const frame of frames) observer.observe(frame);
}
