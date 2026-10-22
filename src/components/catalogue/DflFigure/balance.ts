import { ambientSwing } from './ambient';

// The approved balance artwork, rendered in the training loop's shared clock.
import { paper } from './ink';
import { neon } from './material';
const bag = [
    'M-6 38L-10 29Q-6 31-2 28Q3 32 9 29L6 38C8 44 17 49 19 59C21 68 15 73 3 74C-9 75-19 72-19 63C-20 53-10 45-6 38Z',
    'M-7 38Q0 40 7 38M-7 41Q0 43 7 40M-3 31L-1 36M4 32L3 36',
    'M-4 46C-9 51-12 57-10 62M5 46Q10 51 10 56M-7 68Q-1 71 6 69M-5 40C-12 36-15 41-10 43L-6 41M5 40Q11 42 10 47',
  ].map((d) => new Path2D(d)),
  beam = [
    'M69 43C76 37 91 39 105 39L144 40M156 40L195 39C209 39 224 37 231 43',
    'M69 45Q105 46 144 45M156 45Q195 46 231 45',
    'M85 41L136 42M164 42L215 41',
    'M150 49V68',
  ].map((d) => new Path2D(d));
export function drawDecisionBalance(
  ctx: CanvasRenderingContext2D,
  ambient: number,
  sweep: number | null,
  stroke: number,
) {
  const angle = ((0.5 + 2.2 * ambientSwing(ambient, 0.66)) * Math.PI) / 180;
  function draw(glow = false) {
    ctx.save();
    ctx.translate(-150, -102);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke;
    if (!glow) ctx.strokeStyle = neon.body;
    function path(d: string | Path2D, a = 1) {
      const p = typeof d === 'string' ? new Path2D(d) : d;
      ctx.globalAlpha = glow ? 0.85 : a * 0.95;
      if (glow) {
        ctx.stroke(p);
        return;
      }
      ctx.save();
      ctx.lineWidth = stroke * (a < 0.6 ? 0.45 : a < 0.8 ? 0.7 : 1);
      ctx.shadowColor = neon.halo;
      ctx.shadowBlur = a > 0.6 ? 5 : 0;
      ctx.stroke(p);
      ctx.shadowBlur = 0;
      if (a > 0.6) {
        ctx.lineWidth *= 0.36;
        ctx.strokeStyle = neon.core;
        ctx.stroke(p);
      }
      ctx.restore();
    }
    function circle(x: number, y: number, r: number) {
      ctx.globalAlpha = glow ? 0.85 : 0.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    path('M150 53V145Q150 151 140 156L127 160Q150 166 173 160L160 156Q150 151 150 145', 0.95);
    ctx.save();
    ctx.translate(150, 43);
    ctx.rotate(angle);
    ctx.translate(-150, -43);
    beam.forEach((p, i) => {
      if (i === 0) path(p, 1);
    });
    circle(69, 43, 2);
    circle(231, 43, 2);
    ctx.restore();
    circle(150, 43, 5);
    circle(150, 43, 1.6);
    [-81, 81].forEach((dx) => {
      ctx.save();
      ctx.translate(150 + dx * Math.cos(angle), 43 + dx * Math.sin(angle));
      ctx.globalAlpha = glow ? 0.85 : 0.6;
      ctx.beginPath();
      ctx.ellipse(0, 6, 1.8, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      path('M-1 9L-29 73M1 9L29 73', 0.65);
      path('M0 9L2 26', 0.26);
      ctx.beginPath();
      ctx.ellipse(0, 74, 30, 4, 0, 0, Math.PI * 2);
      ctx.globalAlpha = glow ? 0.85 : 0.26 * 0.78;
      ctx.stroke();
      if (!glow) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = neon.body;
        ctx.fill(bag[0]);
        ctx.restore();
      }
      bag.forEach((p, i) => {
        if (i !== 2) path(p, i === 2 ? 0.55 : i === 1 && true ? 0.45 : 1);
      });
      path('M-30 74Q-25 80 0 80Q25 80 30 74');
      path('M-29 76Q0 84 29 76', 0.32);
      ctx.restore();
    });
    ctx.restore();
  }
  draw();
  if (sweep !== null) {
    ctx.save();
    const head = -145 + sweep * 290,
      g = ctx.createLinearGradient(head - 30, 0, head + 30, 0);
    g.addColorStop(0, 'transparent');
    g.addColorStop(0.5, paper);
    g.addColorStop(1, 'transparent');
    ctx.strokeStyle = g;
    draw(true);
    ctx.restore();
  }
}
