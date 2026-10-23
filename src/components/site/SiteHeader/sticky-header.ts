import { enhance } from '../../../lib/lifecycle';

// Anchor clearance follows the header's actual rows, including after resizing or font loading.
// The CSS height remains a conservative fallback before the first observation or without JS.
enhance('[data-sticky-header]', (header) => {
  if (!('ResizeObserver' in window)) return;
  let height = 0;
  new ResizeObserver(([entry]) => {
    const next = entry.borderBoxSize[0]?.blockSize;
    if (!next || next === height) return;
    height = next;
    document.documentElement.style.setProperty('--site-header-height', `${height.toFixed(2)}px`);
  }).observe(header, { box: 'border-box' });
});
