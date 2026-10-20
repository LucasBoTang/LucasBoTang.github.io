import { enhance, onScrollFrame } from './lifecycle';

// On screens without hover, a lit unit (`data-lit`, motion.css) is lit while it is the one being
// read instead: the unit across the middle of the window, or failing that the nearest one within a
// quarter of the window, is marked `data-focused`, and so is a unit as it is tapped. Scrolling on
// passes the mark to the next unit, so the page answers the reader as pointing does on a desktop.

const hoverQuery = matchMedia('(hover: hover) and (pointer: fine)');
const REACH = 0.25;

enhance('body', () => {
  // Full-page navigation keeps these targets stable for this document's lifetime.
  const units = [...document.querySelectorAll<HTMLElement>('[data-lit]')];
  if (!units.length) return;
  let focused: HTMLElement | undefined;

  const focus = (unit?: HTMLElement) => {
    if (unit === focused) return;
    focused?.removeAttribute('data-focused');
    focused = unit;
    unit?.setAttribute('data-focused', '');
  };
  /** Marks the unit being read, or none where a pointer can point instead. */
  const update = () => {
    if (hoverQuery.matches) return focus(undefined);
    const middle = innerHeight / 2;
    let nearest: HTMLElement | undefined;
    let distance = innerHeight * REACH;
    for (const unit of units) {
      const { top, bottom } = unit.getBoundingClientRect();
      const away = top > middle ? top - middle : bottom < middle ? middle - bottom : 0;
      if (away < distance) [nearest, distance] = [unit, away];
    }
    focus(nearest);
  };
  const scrollWatch = onScrollFrame(update);
  hoverQuery.addEventListener('change', scrollWatch.request);
  addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'touch' || hoverQuery.matches) return;
    const unit =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-lit]') : null;
    if (unit) focus(unit);
  });
  update();
});
