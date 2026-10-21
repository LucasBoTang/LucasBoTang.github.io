import { theme } from '../../../data/theme';
import { arrival, arrivalFrames } from '../../../lib/arrival';
import type { Timeline } from '../../../lib/timeline';
import {
  isHomeReturn,
  openingEvents,
  openingTiming as time,
  part,
  skipHomeIntro,
  type HomeOpeningGroup,
} from '../opening/opening';
import { createNameScramble, nameScrambleDuration } from './name-scramble';
import { createPortraitDevelop } from './portrait-develop';

/** A contact icon jumps into place with an echo like the name's locking letters, in the lighter
 * signal blue so it shows against the blue icon. */
const ICON_ECHO = `drop-shadow(-2px 0 0 ${theme['signal-light']})`;
const ICON_LANDING: Keyframe[] = [
  { opacity: 0, offset: 0, easing: 'steps(1, end)' },
  {
    opacity: 1,
    transform: 'translateX(-4px)',
    filter: ICON_ECHO,
    offset: 0.15,
    easing: 'steps(1, end)',
  },
  { transform: 'translateX(2px)', filter: ICON_ECHO, offset: 0.4, easing: 'steps(1, end)' },
  { transform: 'none', filter: ICON_ECHO, offset: 0.6, easing: 'steps(1, end)' },
  { opacity: 1, transform: 'none', filter: 'none', offset: 1 },
];

/**
 * The hero's part of the home opening: the portrait develops as a screen of dots and glitches into the
 * photograph, its lower third turns blue and shifts, the name decodes, and the framing arrives.
 * The framing joins `identity`; typing runs on its own clock and the action follows the lanes.
 */
export function addHeroOpening(timeline: Timeline<HomeOpeningGroup>, hero: HTMLElement) {
  const returning = isHomeReturn();
  const followAt = time.formStart + arrival.beat;
  hero.setAttribute('data-opening', '');
  hero.setAttribute('data-intro-waiting', '');
  hero.setAttribute('data-bio-waiting', '');
  // The photograph develops as a screen of dots and glitches in (see portrait-develop.ts); the
  // real image layers stay hidden until the glitch settles on the photograph, then take over.
  const develop = createPortraitDevelop(hero);
  const photoLayers = hero.querySelectorAll('.portrait, .portrait-signal');
  // The blue third's height and shift, as HomeHero's styles set them.
  const style = getComputedStyle(hero);
  const cropped = `inset(0 0 ${style.getPropertyValue('--ink-height').trim()} 0)`;
  const shifted = `translateX(${style.getPropertyValue('--ink-shift').trim()})`;
  photoLayers.forEach((layer) =>
    timeline.animate(
      layer,
      [{ opacity: 0 }, { opacity: 0 }],
      { duration: time.glitchEnd, easing: 'linear' },
      'identity',
    ),
  );
  timeline.animate(
    hero.querySelector('.portrait'),
    [
      { clipPath: 'inset(0)', offset: 0 },
      { clipPath: 'inset(0)', offset: time.split / time.shiftEnd },
      { clipPath: cropped, offset: (time.split + 1) / time.shiftEnd },
      { clipPath: cropped, offset: 1 },
    ],
    { duration: time.shiftEnd, easing: 'linear' },
    'identity',
  );
  timeline.animate(
    hero.querySelector('.portrait-ink'),
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: time.blueEnd - time.blueStart, delay: time.blueStart, easing: 'linear' },
    'identity',
  );
  // Colour and position jump on the same frame; the rightward channel tear then settles.
  hero.querySelectorAll('.portrait-ink, .portrait-signal').forEach((layer) =>
    timeline.animate(
      layer,
      [
        { transform: 'translateX(0)', offset: 0, easing: 'steps(1, end)' },
        { transform: shifted, offset: 0.0034 },
        { transform: shifted, offset: 1 },
      ],
      { duration: time.shiftEnd - time.shiftStart, delay: time.shiftStart, easing: 'linear' },
      'identity',
    ),
  );
  // The name decodes over the shift; its own text waits until the decoding letters are done.
  const nameElement = hero.querySelector<HTMLElement>('h1');
  const nameBase = hero.querySelector('.name-base');
  const scramble = nameElement ? createNameScramble(nameElement) : undefined;
  const letters = (nameBase?.textContent ?? '').replace(/\s/g, '').length;
  timeline.animate(
    nameBase,
    [{ opacity: 0 }, { opacity: 0 }],
    { duration: time.tearStart + nameScrambleDuration(letters), easing: 'linear' },
    'identity',
  );
  // The name's small signal marks start hopping as its letters start to decode.
  timeline.appear(hero.querySelector('.name-marks'), time.tearStart, 'identity', time.marksFade);
  // The contact icons land one after another as the name's letters lock; each label follows.
  const contacts = hero.querySelector(part('contacts'));
  contacts?.querySelectorAll('[data-contact-icon]').forEach((icon, i) => {
    const at = time.shiftStart + time.contactsDelay + i * time.iconStagger;
    timeline.animate(
      icon,
      ICON_LANDING,
      { duration: time.iconLand, delay: at, easing: 'linear' },
      'identity',
    );
    timeline.appear(
      icon.parentElement?.querySelector('[data-contact-label]') ?? null,
      at + time.labelDelay,
      'identity',
      time.labelFade,
    );
  });
  // The affiliation arrives with the portrait's first dots, rising a little into place.
  const arrive = (element: Element | null, delay: number) =>
    element &&
    timeline.animate(
      element,
      arrivalFrames(element),
      { duration: arrival.duration, delay, easing: arrival.easing },
      'identity',
    );
  arrive(hero.querySelector('.affiliation'), time.formStart);
  if (returning) {
    // One reading passage: both paragraphs arrive together, using the site's shared fade and rise.
    arrive(hero.querySelector('.hero-intro'), followAt);
    arrive(hero.querySelector('.hero-bio'), followAt);
  }
  // The action shares the first research light's arrival, without a separate rising motion.
  timeline.appear(hero.querySelector('.hero-actions'), 0, 'actions', time.actionFade);

  const photo = hero.querySelector<HTMLImageElement>('.portrait');
  return {
    /** Settles once the photograph and the pixel picture have decoded, or failed to. */
    ready: Promise.all([photo?.decode().catch(() => {}), develop.ready]),
    start() {
      hero.dataset.openingStarted = String(performance.now());
      scramble?.play();
      // Without the development, the photograph fades in with the affiliation and bio. The
      // signal canvas is left to its own styles, which show it only while motion runs.
      if (!develop.play())
        photo?.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: time.plainFade,
          delay: time.formStart,
          fill: 'forwards',
        });
    },
    /** The lanes follow the affiliation while fresh prose keeps typing. On returns, the prose
     * fades in first and the lanes follow it by their shorter beat. */
    scheduleCues() {
      timeline.later(() => hero.removeAttribute('data-opening'), time.shiftEnd);
      timeline.later(
        () => hero.dispatchEvent(new Event(openingEvents.lanesReady)),
        followAt + (returning ? time.returnLaneDelay : 0),
      );
      if (returning) {
        timeline.later(
          () => hero.dispatchEvent(new Event(openingEvents.introComplete)),
          followAt + arrival.duration,
        );
      }
    },
    /** The greeting is the first part of the opening. */
    startTyping() {
      hero.removeAttribute('data-intro-waiting');
    },
    /** The bio begins with the affiliation and portrait's first dots. */
    startBio() {
      hero.removeAttribute('data-bio-waiting');
    },
    skip() {
      develop.stop();
      scramble?.finish();
      hero.removeAttribute('data-opening');
      hero.removeAttribute('data-intro-waiting');
      hero.removeAttribute('data-bio-waiting');
      skipHomeIntro(hero);
    },
  };
}
