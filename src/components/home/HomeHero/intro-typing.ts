import { createTyping } from '../../ui/TypedText/typed-text';
import { openingEvents } from '../opening/opening';

/** Keeps the home introduction on the portrait and research lanes' existing clock. */
export function createIntroTyping(hero: HTMLElement) {
  const host = hero.querySelector<HTMLElement>('[data-typed-text]');
  if (!host) return { setRunning: () => {}, finish: () => {} };
  return createTyping(host, {
    thinkBefore: { machine: 150, mathematical: 240 },
    slipWord: 'algorithms',
    held: () => hero.hasAttribute('data-intro-waiting'),
    onStart: () => hero.dispatchEvent(new Event(openingEvents.introStart)),
    onComplete: () => hero.dispatchEvent(new Event(openingEvents.introComplete)),
  });
}
