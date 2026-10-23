interface CompositionBox {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}
interface ReadingBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}
export type SignalStage = 'mapping' | 'correction' | 'update' | 'loss';
interface CompositionPath {
  d: string;
  stage: SignalStage;
}

/** Connection geometry in composition-local CSS pixels; no DOM reads or writes. */
export function compositionPaths({
  input,
  map,
  cor,
  op,
  loss,
  readings,
  network,
  mobile,
  gap = 7,
}: {
  input: CompositionBox;
  map: CompositionBox;
  cor: CompositionBox;
  op: CompositionBox;
  loss: CompositionBox;
  readings: ReadingBox;
  network: { top: number; height: number };
  mobile: boolean;
  gap?: number;
}): CompositionPath[] {
  const paths: CompositionPath[] = [];
  const add = (d: string, stage: SignalStage) => paths.push({ d, stage });
  const forkX = readings.right + 12,
    forkY = readings.top + readings.height / 2;
  const connectionY = network.top + network.height / 2;
  if (mobile) {
    const branchY = map.y - 24;
    const inputBottom = readings.bottom + 6;
    const halfLink = 7;
    add(`M${map.cx} ${inputBottom}V${map.y - 4}`, 'mapping');
    add(`M${map.cx} ${branchY}H${cor.cx}V${cor.y - 4}`, 'correction');
    const horizontalCenter = (map.x + map.w + cor.x) / 2;
    const updateCenter = (cor.y + cor.h + op.y) / 2;
    add(
      `M${horizontalCenter - halfLink} ${connectionY}H${horizontalCenter + halfLink}`,
      'correction',
    );
    add(`M${op.cx} ${updateCenter - halfLink}V${updateCenter + halfLink}`, 'update');
  } else {
    add(`M${map.cx} ${input.y + input.h + gap}V${map.y - gap}`, 'mapping');
    add(`M${forkX} ${forkY}H${cor.cx}V${cor.y - gap}`, 'correction');
    add(`M${map.x + map.w + gap} ${connectionY}H${cor.x - gap}`, 'correction');
    add(`M${cor.x + cor.w + gap} ${connectionY}H${op.x - gap}`, 'update');
  }
  // Leave room beneath the printed values and before the Loss divider.
  add(`M${op.cx} ${op.y + op.h - 3}V${loss.y - 4}`, 'loss');
  return paths;
}
