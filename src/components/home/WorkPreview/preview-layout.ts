/** Keep all artwork at one visible width, respecting each plate's height and source bleed. */
export function observePreviewLayout(plates: HTMLElement[]): void {
  // One display width for all three artworks. The tallest composition sets the limit;
  // the other two keep their own aspect ratios and sit in the centre of their plates.
  // Document bleed protects overhanging artwork; it is not part of the visible composition width.
  const fit = () => {
    const sizes = plates.map((plate) => ({
      plate,
      width: plate.clientWidth,
      // Use the existing row padding for the artwork without changing the document flow.
      height:
        plate.querySelector<HTMLElement>('.work-preview-picture')?.clientHeight ||
        plate.clientHeight,
      sourceWidth: Number(plate.dataset.previewWidth),
      sourceHeight: Number(plate.dataset.previewHeight),
      contentWidth:
        Number(plate.dataset.previewWidth) - 2 * Number(plate.dataset.previewBleed ?? 0),
    }));
    const displayWidth = Math.min(
      ...sizes.map((size) =>
        Math.min(
          (size.width * size.contentWidth) / size.sourceWidth,
          (size.height * size.contentWidth) / size.sourceHeight,
        ),
      ),
    );
    sizes.forEach(({ plate, contentWidth }) => {
      plate.style.setProperty('--preview-scale', String(displayWidth / contentWidth));
    });
  };
  const observer = new ResizeObserver(fit);
  plates.forEach((plate) => observer.observe(plate));
}
