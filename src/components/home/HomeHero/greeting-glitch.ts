import { reducedMotionQuery } from '../../../lib/motion';
import { openingTiming as time } from '../opening/opening';

/** Snapshot the visible prefix for displaced fragments while the original keeps typing. */
export function createGreetingGlitch(host: HTMLElement) {
  const layer = host.querySelector<HTMLElement>('.intro-typing');
  const target = host.querySelector<HTMLElement>('[data-intro-typed]');
  // Waiting and playing are consecutive phases, so only one deadline is live at a time.
  let timer = 0;
  const stop = () => {
    clearTimeout(timer);
    if (!layer) return;
    delete layer.dataset.greetingGlitch;
    delete layer.dataset.greetingSignal;
    layer.style.removeProperty('--greeting-glitch');
    if (!layer.getAttribute('style')) layer.removeAttribute('style');
  };
  return {
    play() {
      if (!layer || !target) return;
      stop();
      timer = window.setTimeout(() => {
        if (document.hidden || reducedMotionQuery().matches) return stop();
        const prefix = Array.from(target.querySelectorAll('.intro-letter:not([data-unseen])'))
          .map((letter) => letter.textContent)
          .join('');
        layer.dataset.greetingSignal = prefix;
        layer.style.setProperty('--greeting-glitch', `${time.greetingGlitch}ms`);
        layer.dataset.greetingGlitch = '';
        timer = window.setTimeout(stop, time.greetingGlitch);
      }, time.greetingGlitchDelay);
    },
    stop,
  };
}
