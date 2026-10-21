import { onScrollFrame } from '../../../lib/lifecycle';
import { openingTiming as time } from '../opening/opening';
import { lockGreeting } from './greeting-lock';

/** Scale the one-line typing layer around its final reading anchor inside the copy field.
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
    const bounds = hero.querySelector('.hero-copy')!.getBoundingClientRect();
    // Fit the shared heading tier within the copy field, keeping the first letter anchored.
    const headingScale =
      parseFloat(getComputedStyle(paragraph, '::before').fontSize) /
      parseFloat(getComputedStyle(host).fontSize);
    const availableScale = Math.min(
      (bounds.right - letter.left) / text.width,
      (window.innerHeight - letter.top) / text.height,
    );
    const scale = Math.min(previous ? previous.width / letter.width : headingScale, availableScale);
    start = `scale(${scale})`;
    // Round outwards: a fractional shrink must not wrap the final word during the fold.
    layer.style.width = `${Math.ceil(text.width * 100) / 100}px`;
    layer.style.transformOrigin = `${letter.left - origin.left}px ${letter.top - origin.top}px`;
    layer.style.transform = start;
    paragraph.style.setProperty('--greeting-scale', String(scale));
    remeasureCursor();
  };
  const fold = (duration: number) => {
    animation = layer.animate([{ transform: start }, { transform: 'scale(1)' }], {
      duration,
      easing: time.greetingEasing,
      fill: 'forwards',
    });
    // Finish on the animation's actual last frame, rather than a timer that can run ahead of it.
    void animation.finished.then(finish, () => {});
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
          frame();
        }, time.greetingRest),
      );
    },
    finish,
  };
}
