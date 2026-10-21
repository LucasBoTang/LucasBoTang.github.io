import { onScrollFrame } from '../../../lib/lifecycle';
import { openingTiming as time } from '../opening/opening';
import { lockGreeting } from './greeting-lock';

/** Move the entire one-line typing layer from the screen centre into its reading position.
 * The accessible paragraph and the bio retain their normal layout throughout. */
export function createGreetingEntrance(
  hero: HTMLElement,
  host: HTMLElement,
  frame: () => void,
  landed: () => void,
  remeasureCursor: () => void,
) {
  const paragraph = host.closest<HTMLElement>('.hero-intro')!;
  const target = host.querySelector<HTMLElement>('[data-intro-typed]')!;
  const layer = target.parentElement!;
  const first = target.querySelector<HTMLElement>('.intro-letter')!;
  const unlock = lockGreeting();
  const timers: number[] = [];
  let animation: Animation | undefined;
  let start = '';
  let finished = false;
  let settling = false;
  let foldStartedAt = 0;

  const layout = (previous?: DOMRect) => {
    layer.style.transform = 'none';
    layer.style.removeProperty('width');
    const origin = layer.getBoundingClientRect();
    const text = target.getBoundingClientRect();
    const letter = first.getBoundingClientRect();
    const bounds = hero.getBoundingClientRect();
    // Resolve the shared title tier through CSS and fit the intact sentence inside the viewport.
    const titleScale =
      parseFloat(getComputedStyle(paragraph, '::before').fontSize) /
      parseFloat(getComputedStyle(host).fontSize);
    const availableScale = Math.min(
      bounds.width / text.width,
      (window.innerHeight * 0.8) / text.height,
    );
    const scale = Math.min(previous ? previous.width / letter.width : titleScale, availableScale);
    const left = Math.max(
      bounds.left,
      Math.min(
        previous?.left ?? (window.innerWidth - text.width * scale) / 2,
        bounds.right - text.width * scale,
      ),
    );
    const top = Math.max(
      0,
      Math.min(
        previous?.top ?? window.innerHeight * 0.46 - (text.height * scale) / 2,
        window.innerHeight - text.height * scale,
      ),
    );
    const dx = left - origin.left - (letter.left - origin.left) * scale;
    const dy = top - origin.top - (letter.top - origin.top) * scale;
    start = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${scale})`;
    // Round outwards: a fractional shrink must not wrap the final word during the fold.
    layer.style.width = `${Math.ceil(text.width * 100) / 100}px`;
    layer.style.transformOrigin = 'top left';
    layer.style.transform = start;
    paragraph.style.setProperty('--greeting-scale', String(scale));
    remeasureCursor();
  };
  const fold = (duration: number) => {
    animation = layer.animate(
      [{ transform: start }, { transform: 'translate(0px, 0px) scale(1)' }],
      {
        duration,
        easing: time.greetingEasing,
        fill: 'forwards',
      },
    );
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach((timer) => clearTimeout(timer));
    animation?.cancel();
    viewportWatch.stop();
    layer.removeAttribute('style');
    delete paragraph.dataset.greetingOpening;
    delete paragraph.dataset.greetingFolding;
    paragraph.style.removeProperty('--greeting-scale');
    if (!paragraph.getAttribute('style')) paragraph.removeAttribute('style');
    unlock();
    remeasureCursor();
    frame();
    landed();
  };
  let width = window.innerWidth;
  let height = window.innerHeight;
  const viewportWatch = onScrollFrame(() => {
    if (width === window.innerWidth && height === window.innerHeight) return;
    width = window.innerWidth;
    height = window.innerHeight;
    const current = foldStartedAt ? first.getBoundingClientRect() : undefined;
    animation?.cancel();
    layout(current);
    if (foldStartedAt) fold(Math.max(0, time.greetingFold - (performance.now() - foldStartedAt)));
  });
  paragraph.dataset.greetingOpening = '';
  try {
    layout();
  } catch (error) {
    finish();
    throw error;
  }
  timers.push(window.setTimeout(finish, time.greetingLimit));
  return {
    get active() {
      return !finished;
    },
    settle() {
      if (finished || settling) return;
      settling = true;
      timers.push(
        window.setTimeout(() => {
          paragraph.dataset.greetingFolding = '';
          foldStartedAt = performance.now();
          fold(time.greetingFold);
          timers.push(window.setTimeout(frame, time.greetingFrame));
          timers.push(window.setTimeout(finish, time.greetingFold));
        }, time.greetingRest),
      );
    },
    finish,
  };
}
