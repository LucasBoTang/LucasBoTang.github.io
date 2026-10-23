import { isPhone } from '../../../lib/breakpoints';
import { createTyping } from '../../ui/TypedText/typed-text';
import { isHomeReturn, openingEvents, openingTiming as time } from '../opening/opening';
import { createGreetingEntrance } from './greeting-entrance';
import { createGreetingGlitch } from './greeting-glitch';

/** The bio joins the greeting's fold; the portrait follows when the greeting lands. */
export function createIntroTyping(hero: HTMLElement) {
  const greeting = hero.querySelector<HTMLElement>('.hero-intro [data-typed-text]');
  const bio = hero.querySelector<HTMLElement>('.hero-bio [data-typed-text]');
  if (!greeting || !bio) return { start: () => {}, setRunning: () => {}, finish: () => {} };
  const returning = isHomeReturn();
  const phone = isPhone();
  const greetingKey = phone ? time.phoneGreetingKey : time.greetingKey;
  const lineHeight = parseFloat(getComputedStyle(greeting).lineHeight);
  let greeted = false;
  let greetingStartsAt = 0;
  let entrance: ReturnType<typeof createGreetingEntrance> | undefined;
  const glitch = createGreetingGlitch(greeting);
  // The page consumes this once; landing also releases it if the fold was interrupted.
  const releaseFrame = () => {
    greeted = true;
    hero.dispatchEvent(new Event(openingEvents.frameReady));
  };
  const releaseIdentity = () => {
    if (returning || hero.hasAttribute('data-identity-ready')) return;
    hero.dataset.identityReady = '';
    hero.dispatchEvent(new Event(openingEvents.identityReady));
  };
  const body = createTyping(bio, {
    held: () => !greeted || hero.hasAttribute('data-bio-waiting'),
    keyDelay: phone ? time.phoneTypingKey : time.typingKey,
    thinkBefore: phone ? time.phoneThinkBefore : time.thinkBefore,
    // The short, wrapped phone passage reads continuously; the desktop keeps its one correction.
    slipWord: phone ? undefined : time.slipWord,
    slipPace: time.slipPace,
    cue: {
      after: ' ',
      onReach: () => document.dispatchEvent(new Event(openingEvents.bioStart)),
    },
    endCue: {
      lead: time.laneLead,
      onReach: () => {
        if (!returning && !isPhone()) hero.dispatchEvent(new Event(openingEvents.lanesReady));
      },
    },
    onComplete: () => {
      if (!returning) hero.dispatchEvent(new Event(openingEvents.introComplete));
    },
  });
  const hello = createTyping(greeting, {
    held: () => hero.hasAttribute('data-intro-waiting') || performance.now() < greetingStartsAt,
    keyDelay: !returning && !isPhone() ? time.greetingOpeningKey : greetingKey,
    letterFade: !returning && !isPhone() ? time.greetingLetterFade : 0,
    cue: {
      after: hero.querySelector('h1')?.getAttribute('aria-label') ?? '',
      onReach: () => {
        if (
          entrance?.active &&
          !isPhone() &&
          greeting.getBoundingClientRect().height <= lineHeight + 1
        )
          glitch.play();
      },
    },
    commaPause: phone ? time.phoneCommaPause : time.commaPause,
    onComplete: () => {
      glitch.stop();
      if (entrance) entrance.settle();
      else {
        releaseFrame();
        releaseIdentity();
      }
    },
  });
  // A site return shows both passages whole; their parents arrive with the other reading units.
  // Keep the completed typing layer so the final blue caret still blinks and follows resizes.
  if (returning) {
    hello.finish();
    body.finish();
  }
  return {
    start() {
      if (
        returning ||
        isPhone() ||
        hero.hasAttribute('data-intro-skipped') ||
        greeting.hasAttribute('data-typing-complete')
      )
        return;
      const box = greeting.getBoundingClientRect();
      if (box.bottom <= 0) return;
      // A fixed anchor below a shallow window cannot serve as a visible opening. Show the
      // greeting whole and let the portrait lead, with no interaction lock.
      if (box.top >= window.innerHeight - lineHeight) {
        hello.finish();
        return;
      }
      // Narrow desktop columns retain their natural wrapped copy and ordinary typing cadence.
      if (box.height > lineHeight + 1) return;
      entrance = createGreetingEntrance(
        hero,
        greeting,
        releaseFrame,
        () => {
          hello.finish();
          releaseIdentity();
        },
        hello.remeasure,
      );
      greetingStartsAt = performance.now() + time.greetingLead;
      hello.setRunning(!document.hidden);
    },
    setRunning(enabled: boolean) {
      // Read both rectangles first. A jump past either paragraph completes it, so returning
      // never replays text the reader has already moved beyond.
      const greetingBox = greeting.getBoundingClientRect();
      const bioBox = bio.getBoundingClientRect();
      if (!enabled || isPhone() || greetingBox.height > lineHeight + 1) glitch.stop();
      // Once complete, any visible part can resume the caret; typing waits for a full first line.
      const visible = (host: HTMLElement, box: DOMRect) =>
        box.bottom > 0 &&
        box.top < window.innerHeight - (host.hasAttribute('data-typing-complete') ? 0 : lineHeight);
      if (enabled && !entrance?.active && greetingBox.bottom <= 0) hello.finish();
      if (enabled && bioBox.bottom <= 0) body.finish();
      hello.setRunning(enabled && (entrance?.active || visible(greeting, greetingBox)));
      body.setRunning(enabled && visible(bio, bioBox));
    },
    finish() {
      glitch.stop();
      entrance?.finish();
      hello.finish();
      body.finish();
    },
  };
}
