import { networkGeometry } from './geometry';

interface FlowBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface ModulePorts {
  x: number;
  y: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}
interface FlowGeometry {
  network: ModulePorts;
  optimizer: ModulePorts;
  balance: ModulePorts;
  polyBounds: FlowBox;
  gridScale: number;
  neuralScale: number;
  data: FlowBox;
  modelCaption: FlowBox;
  mobile: boolean;
}

/** Connector paths in root-local CSS pixels, preserving the authored optical corrections. */
export function flowPaths({
  network,
  optimizer,
  balance,
  polyBounds,
  gridScale,
  neuralScale,
  data,
  modelCaption,
  mobile,
}: FlowGeometry) {
  const sheetScale = data.w / 140,
    sheetInset = (80 - 80 * sheetScale) / 2;
  const gap = 12;
  const featureX = network.x - networkGeometry.halfWidth * Math.cos(0.24) * neuralScale,
    featureY = network.y + networkGeometry.rowStep * neuralScale + gap;
  const gridInX = balance.x + 81 * gridScale,
    gridInY = balance.y - 69 * gridScale - gap,
    truthInY = balance.y + 15 * gridScale;

  const portY = network.y + 1;
  const predictionAnchor = {
    x: (network.right + optimizer.left) / 2 - (mobile ? 20 : 0),
    y: (portY + optimizer.y) / 2 - (mobile ? 12 : 0),
  };
  // Follow the raised neural network while leaving the two-line sign clear.
  // Leave the visible front sheet clear, including its corner in the compact layout.
  const cornerGap = gap / Math.SQRT2;
  const featureStart = mobile
    ? {
        x: data.x + 20 * sheetScale - cornerGap,
        y: data.y + sheetInset + 26 * sheetScale - cornerGap,
      }
    : {
        x: data.x + 20 * sheetScale - gap,
        y: data.y + sheetInset + 42 * sheetScale,
      };
  const predictionEnd = {
    x: optimizer.x + 10,
    y: optimizer.y - 100 * Math.min(polyBounds.w / 280, 0.85) - 16,
  };
  const decisionStartY = Math.max(optimizer.bottom + 32, modelCaption.y + modelCaption.h + 12);
  const paths = mobile
    ? [
        `M${featureStart.x} ${featureStart.y} C${featureX - 38} ${data.y - 38} ${featureX - 26} ${featureY + 68} ${featureX} ${featureY}`,
        `M${network.right + gap} ${portY} C${(network.right + gap + predictionEnd.x) / 2} ${portY + 10} ${predictionEnd.x - 18} ${predictionEnd.y - 24} ${predictionEnd.x} ${predictionEnd.y}`,
        `M${optimizer.x + 18} ${decisionStartY} C${optimizer.x + 18} ${decisionStartY + 24} ${gridInX} ${gridInY - 28} ${gridInX} ${gridInY}`,
        `M${data.x + data.w * 0.55} ${data.y + data.h + gap} C${data.x + data.w * 0.55} ${balance.y + 8} ${balance.left - gap - 32} ${balance.y + 8} ${balance.left - gap} ${balance.y + 8}`,
      ]
    : [
        `M${featureStart.x} ${featureStart.y} C${featureX - 42} ${featureStart.y - 40} ${featureX - 30} ${featureY + 68} ${featureX} ${featureY}`,
        `M${network.right + gap} ${portY} C${network.right + gap + 38} ${portY} ${optimizer.left - gap - 38} ${optimizer.y} ${optimizer.left - gap} ${optimizer.y}`,
        `M${optimizer.right + gap} ${optimizer.y} C${optimizer.right + gap + 42} ${optimizer.y + 22} ${gridInX + 12} ${gridInY - 36} ${gridInX} ${gridInY}`,
        `M${data.x + (data.w * 124) / 140 + gap} ${data.y + data.h * 0.52} C${data.x + data.w + 30} ${data.y + data.h * 0.52 - 4} ${balance.left - gap - 30} ${truthInY - 4} ${balance.left - gap} ${truthInY}`,
      ];
  return { paths, predictionAnchor };
}
