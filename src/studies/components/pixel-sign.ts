import { enhance } from '../../lib/lifecycle';
import { reducedMotionQuery, watchActivity } from '../../lib/motion';

// Stable light, an inward pixel spiral, then row-major reconstruction.
function setupPixelSign(canvas: HTMLCanvasElement) {
  const maybeContext = canvas.getContext('2d');
  if (!maybeContext) return;
  const context = maybeContext;
  const reducedMotion = reducedMotionQuery();
  let width = 0,
    height = 0,
    frame = 0,
    visible = false;
  const pitch = 3.05;
  // Begin at the write-back phase so the first visible state is drawn in.
  let elapsed = 8100,
    previous = 0;
  let spiral = new Int32Array(0);
  // Walk a coarse grid so the spiral has a visible three-cell-wide path.
  // Each tile extinguishes as a unit; the full traversal still takes 2.6 seconds.
  function buildSpiral() {
    const columns = Math.ceil(width / pitch),
      rows = Math.ceil(height / pitch);
    const tile = 3;
    const tileColumns = Math.ceil(columns / tile),
      tileRows = Math.ceil(rows / tile);
    spiral = new Int32Array(columns * rows);
    let left = 0,
      right = tileColumns - 1,
      top = 0,
      bottom = tileRows - 1,
      rank = 0;
    const visit = (tx: number, ty: number) => {
      const threshold = Math.floor((rank++ / (tileColumns * tileRows)) * columns * rows);
      for (let y = ty * tile; y < Math.min(rows, (ty + 1) * tile); y++) {
        for (let x = tx * tile; x < Math.min(columns, (tx + 1) * tile); x++) {
          spiral[y * columns + x] = threshold;
        }
      }
    };
    while (left <= right && top <= bottom) {
      for (let x = left; x <= right; x++) visit(x, top);
      top++;
      for (let y = top; y <= bottom; y++) visit(right, y);
      right--;
      if (top <= bottom) {
        for (let x = right; x >= left; x--) visit(x, bottom);
        bottom--;
      }
      if (left <= right) {
        for (let y = bottom; y >= top; y--) visit(left, y);
        left++;
      }
    }
  }
  const section = canvas.closest<HTMLElement>('section');
  function draw(now: number) {
    // Do not spend the first reveal while the homepage opening hides this section.
    const openingHidden =
      document.documentElement.hasAttribute('data-opening-pending') ||
      (section !== null && Number(getComputedStyle(section).opacity) < 0.05);
    if (openingHidden && !reducedMotion.matches) {
      previous = 0;
      context.clearRect(0, 0, width, height);
      if (visible && !document.hidden) frame = requestAnimationFrame(draw);
      return;
    }
    if (previous && !reducedMotion.matches) elapsed += Math.min(now - previous, 80);
    previous = now;
    const columns = Math.ceil(width / pitch),
      rows = Math.ceil(height / pitch);
    const total = columns * rows;
    // 5.2s intact; 2.6s extinguish; .3s dark; 2.4s write back.
    const phase = reducedMotion.matches ? 0 : elapsed % 10500;
    const extinguished =
      phase < 5200 ? 0 : Math.min(total, Math.floor(((phase - 5200) / 2600) * total));
    const revealed =
      phase < 7800
        ? total
        : phase < 8100
          ? 0
          : Math.min(total, Math.floor((((phase - 8100) / 2400) * total) / 4) * 4);
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgb(97.44,131.37,168.78)';
    context.shadowColor = 'rgba(106,151,202,.2784)';
    context.shadowBlur = 0.65;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const key = row * columns + col;
        const lit = phase < 7800 ? spiral[key] >= extinguished : key < revealed;
        if (lit) context.fillRect(col * pitch + 0.35, row * pitch + 0.35, 2.35, 2.35);
      }
    if (visible && !document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(draw);
  }
  function resume() {
    cancelAnimationFrame(frame);
    previous = 0;
    if (visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  const resize = new ResizeObserver(() => {
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildSpiral();
    resume();
  });
  resize.observe(canvas);
  watchActivity(canvas, (activity) => {
    visible = activity.inView.size > 0;
    resume();
  });
}

enhance<HTMLCanvasElement>('.pixel-sign', setupPixelSign);
