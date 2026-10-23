// One blue-gray tube material for the four drawings and their mathematical label.
export const neon = {
  body: '#7d9fc9',
  core: '#e0eafa',
  dim: '#4c6485',
  halo: 'rgba(123,158,207,.6)',
};
// CSS-pixel weights, shared by canvas and SVG; dense network edges use an optical correction.
export const neonMetrics = {
  structure: 1.35,
  denseStructure: 1.15,
  axis: 1.05,
  signal: 1.65,
  coreRatio: 0.36,
  nodeRadius: 2.1,
  nodeOutline: 0.65,
  activeNodeRadius: 2.7,
  nodePulse: 0.2,
  halo: 3.5,
};

export function strokeTube(
  ctx: CanvasRenderingContext2D,
  width: number,
  opacity = 1,
  halo = 0,
  body: string | CanvasGradient = neon.body,
  core: string | CanvasGradient = neon.core,
) {
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.lineWidth = width;
  ctx.strokeStyle = body;
  ctx.shadowColor = neon.halo;
  ctx.shadowBlur = halo;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = width * neonMetrics.coreRatio;
  ctx.strokeStyle = core;
  ctx.stroke();
  ctx.restore();
}
