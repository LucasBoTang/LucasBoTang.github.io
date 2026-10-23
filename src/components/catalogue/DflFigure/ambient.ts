/** One gentle ambient rhythm for the four DFL modules, independent of training light. */
const DFL_AMBIENT_PERIOD = 12;
export function ambientSwing(seconds: number, phase = 0) {
  return Math.sin((seconds * Math.PI * 2) / DFL_AMBIENT_PERIOD + phase);
}
const sheets = new WeakMap<Element, [Element, number, number][]>();
export function updateDatasetAmbient(root: Element | null, seconds: number) {
  if (!root) return;
  const u = ambientSwing(seconds);
  const shifts: [string, number, number][] = [
    ['.data-sheet-back', 2, -3.5],
    ['.data-sheet-middle', 0.8, -1],
    ['.data-sheet-front', -0.4, 1.5],
  ];
  if (!sheets.has(root))
    sheets.set(
      root,
      shifts.flatMap(([selector, x, y]) => {
        const node = root.querySelector(selector);
        return node ? [[node, x, y] as [Element, number, number]] : [];
      }),
    );
  for (const [node, x, y] of sheets.get(root)!)
    node.setAttribute('transform', `translate(${(x * u).toFixed(4)} ${(y * u).toFixed(4)})`);
}
