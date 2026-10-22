// One blue-gray tube material for the four drawings and their mathematical label.
export const neon = {
  body: '#7d9fc9',
  core: '#e0eafa',
  dim: '#4c6485',
  halo: 'rgba(123,158,207,.6)',
};
export function strokeTube(ctx: CanvasRenderingContext2D, width: number, opacity = 1, glow = true) {
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.lineWidth = width;
  ctx.strokeStyle = neon.body;
  ctx.shadowColor = neon.halo;
  ctx.shadowBlur = glow ? 5 : 0;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = width * 0.36;
  ctx.strokeStyle = neon.core;
  ctx.stroke();
  ctx.restore();
}
