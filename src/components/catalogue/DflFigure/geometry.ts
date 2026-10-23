// Drawing and wire ports share these envelopes in desktop and compact compositions.
export const networkGeometry = {
  halfWidth: 92,
  layerStep: 184 / 3,
  rowStep: 31.36,
  halfHeight: 68,
};
export const polytopeScale = 0.54;
export const moduleScale = (width: number) => Math.min(width / 280, 0.85);
