import { enhance } from '../../../lib/lifecycle';

// Keep the approved desktop composition intact inside Research's narrowing grid column.
// The 720px page breakpoint matches ResearchSection; phones retain the native compact layout.
enhance<HTMLElement>('[data-l2o-frame]', (frame) => {
  const canvasWidth = 588;
  const canvasHeight = 539;
  const desktop = matchMedia('(min-width: 721px)');
  let availableWidth = frame.clientWidth;
  frame.style.setProperty('--l2o-canvas-width', `${canvasWidth}px`);
  frame.style.setProperty('--l2o-canvas-height', `${canvasHeight}px`);

  function fit() {
    const scaled = desktop.matches && availableWidth > 0 && availableWidth < canvasWidth;
    frame.toggleAttribute('data-scaled', scaled);
    frame.style.setProperty('--l2o-scale', String(scaled ? availableWidth / canvasWidth : 1));
  }

  new ResizeObserver(([entry]) => {
    const width = entry.contentRect.width;
    if (width === availableWidth) return;
    availableWidth = width;
    fit();
  }).observe(frame);
  desktop.addEventListener('change', fit);
  fit();
});
