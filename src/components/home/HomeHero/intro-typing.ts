import { createTyping } from '../../ui/TypedText/typed-text';
import { isHomeReturn, openingEvents, openingTiming as time } from '../opening/opening';

/** The greeting leads; the bio follows with the portrait, once its own first line is visible. */
export function createIntroTyping(hero: HTMLElement) {
  const greeting = hero.querySelector<HTMLElement>('.hero-intro [data-typed-text]');
  const bio = hero.querySelector<HTMLElement>('.hero-bio [data-typed-text]');
  if (!greeting || !bio) return { setRunning: () => {}, finish: () => {} };
  const returning = isHomeReturn();
  const lineHeight = parseFloat(getComputedStyle(greeting).lineHeight);
  let greeted = false;
  const body = createTyping(bio, {
    held: () => !greeted || hero.hasAttribute('data-bio-waiting'),
    keyDelay: time.typingKey,
    endDelay: time.cursorRest,
    sentencePause: time.sentencePause,
    commaPause: time.commaPause,
    thinkBefore: time.thinkBefore,
    slipWord: time.slipWord,
    onComplete: () => {
      if (!returning) hero.dispatchEvent(new Event(openingEvents.introComplete));
    },
  });
  const hello = createTyping(greeting, {
    held: () => hero.hasAttribute('data-intro-waiting'),
    keyDelay: time.greetingKey,
    commaPause: time.commaPause,
    onComplete: () => {
      greeted = true;
      if (returning) return;
      hero.setAttribute('data-greeting-complete', '');
      hero.dispatchEvent(new Event(openingEvents.greetingComplete));
    },
  });
  // A site return shows both passages whole; their parents arrive with the other reading units.
  // Keep the completed typing layer so the final blue caret still blinks and follows resizes.
  if (returning) {
    hello.finish();
    body.finish();
  }
  return {
    setRunning(enabled: boolean) {
      // Read both rectangles first. A jump past either paragraph completes it, so returning
      // never replays text the reader has already moved beyond.
      const greetingBox = greeting.getBoundingClientRect();
      const bioBox = bio.getBoundingClientRect();
      // Once complete, any visible part can resume the caret; typing waits for a full first line.
      const visible = (host: HTMLElement, box: DOMRect) =>
        box.bottom > 0 &&
        box.top < window.innerHeight - (host.hasAttribute('data-typing-complete') ? 0 : lineHeight);
      if (enabled && greetingBox.bottom <= 0) hello.finish();
      if (enabled && bioBox.bottom <= 0) body.finish();
      hello.setRunning(enabled && visible(greeting, greetingBox));
      body.setRunning(enabled && visible(bio, bioBox));
    },
    finish() {
      hello.finish();
      body.finish();
    },
  };
}
