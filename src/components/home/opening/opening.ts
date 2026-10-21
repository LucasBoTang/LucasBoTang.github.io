import { isPhone } from '../../../lib/breakpoints.ts';

// Home opening timings. Portrait times are milliseconds after the identity
// starts (after the desktop greeting, immediately on phones); other keys name their durations.
export const openingTiming = {
  /** The portrait's first dots arrive at `formStart`; phones and returns use the same delay for
   * the affiliation. The pixel picture develops, light parts first, through `formEnd`. */
  formStart: 250,
  formEnd: 800,
  /** Duration: around its region's moment, each dot switches on within this span, so a region
   * lands crisp rather than lingering half-formed. */
  formSpread: 120,
  /** The pixel picture glitches into the photograph between these moments, starting as soon as
   * the face can be made out, while the darker dots are still landing; the photograph shows
   * only where the picture has come up. */
  glitchStart: 450,
  glitchEnd: 850,
  /** The name starts to decode, its letters locking one by one through the shift. */
  tearStart: 700,
  /** The photograph's lower third switches to blue ink between these two moments. */
  blueStart: 850,
  blueEnd: 851,
  /** The full photograph is cropped to its upper two thirds just before the blue arrives, so the
   * two never overlap. */
  split: 849,
  /** The blue third slides right between these moments, straight out of the glitch. */
  shiftStart: 850,
  shiftEnd: 1150,
  /** The home bio types briskly while leaving room for the full portrait effect. */
  typingKey: 9.5,
  /** The ordinary greeting outside the enlarged desktop opening. */
  greetingKey: 22,
  /** Phone paragraphs keep their simple typing treatment at a slightly brisker pace. */
  phoneGreetingKey: 20,
  phoneTypingKey: 12,
  /** The larger desktop opening gives each word more time to read. */
  greetingOpeningKey: 28,
  /** A new opening letter develops briefly, without blur or a change in its position. */
  greetingLetterFade: 60,
  /** Let the cue's last letter develop fully, then tear the typed line once and let it settle. */
  greetingGlitchDelay: 80,
  /** One held displacement, a shorter correction, then a hard lock; typing keeps running. */
  greetingGlitch: 280,
  /** A quiet opening frame before the first keystroke, while resources prepare. */
  greetingLead: 200,
  /** A fresh desktop greeting rests at heading size, then folds around its reading anchor.
   * The frame and bio join the fold; the portrait starts on landing. */
  greetingRest: 200,
  greetingFold: 440,
  greetingEasing: 'cubic-bezier(.4,.14,.3,1)',
  /** Let the fresh desktop lanes begin just before the bio's final keystroke. */
  laneLead: 240,
  /** One short beat separates the fresh portrait's final correction from the research lanes. */
  portraitRest: 240,
  /** Bounded fallback for a stalled greeting, including a background tab. */
  greetingLimit: 5000,
  /** Short breaths at phrase boundaries, with no long stops before adjacent adjectives. */
  thinkBefore: { develop: 55, reusable: 50, decisionmaking: 60 },
  /** Correct one early word while the portrait is still developing quietly. */
  slipWord: 'learning',
  slipPace: 0.45,
  commaPause: 80,
  /** On a site return, the lanes join this long after the prose starts fading in. */
  returnLaneDelay: 120,
  /** The research lanes join the prose's tail, each `laneOffsets`
   * later. A lane's field opens from its centre over `laneField`, starts drifting at `laneDrift`,
   * and its light swells in `laneLightDelay` after it starts, over `laneLight`. */
  laneOffsets: [0, 140, 280],
  laneField: 1200,
  laneDrift: 160,
  laneLightDelay: 200,
  laneLight: 1250,
  /** The research action starts this far before the last lane settles, then reading follows it. */
  actionLead: 840,
  actionFade: 600,
  /** Reading follows the action's first light while the lanes finish their full expansion. */
  readingDelay: 160,
  /** The site header fades in as the name settles at `frameAt`. The name's signal marks fade in
   * as its letters start to decode. */
  frameAt: 1150,
  headerFade: 900,
  marksFade: 600,
  /** The contact icons land one after another as the name's letters lock: the first
   * `contactsDelay` after the shift starts, then `iconStagger` apart, each over `iconLand` with a
   * signal jump and an echo. Each label fades in `labelDelay` after its icon, over `labelFade`. */
  contactsDelay: 180,
  iconStagger: 70,
  iconLand: 240,
  labelDelay: 120,
  labelFade: 600,
  /** Without the pixel entrance, the photograph fades in over this long. */
  plainFade: 550,
  /** Phones and site returns wait at most this long for the portrait's images to decode. */
  readyTimeout: 1000,
} as const;

// Phones develop immediately without waiting for the off-screen biography.
const phonePortraitTiming = {
  ...openingTiming,
  formStart: 0,
  formEnd: 820,
  glitchStart: 420,
  glitchEnd: 900,
  tearStart: 720,
  blueStart: 900,
  blueEnd: 901,
  split: 899,
  shiftStart: 900,
  shiftEnd: 1230,
} as const;

// On desktop, the first interference joins early, while the dots keep forming more slowly.
// One brief exchange resolves into the blue third, without repeating the interference.
const freshPortraitTiming = {
  ...phonePortraitTiming,
  formEnd: 1000,
  glitchStart: 280,
  glitchEnd: 1080,
  tearStart: 690,
  blueStart: 1080,
  blueEnd: 1081,
  split: 1079,
  shiftStart: 1080,
  shiftEnd: 1440,
} as const;

export const portraitTiming = (returning: boolean, phone = false) =>
  returning ? openingTiming : phone ? phonePortraitTiming : freshPortraitTiming;
export type PortraitTiming = ReturnType<typeof portraitTiming>;

// Home opening cues; the bio's first word also releases idle preparation below.
export const openingEvents = {
  greetingStart: 'home:greeting-start',
  frameReady: 'home:frame-ready',
  identityReady: 'home:identity-ready',
  bioStart: 'home:bio-start',
  lanesReady: 'home:lanes-ready',
  introComplete: 'home:intro-complete',
  skip: 'home:skip-opening',
} as const;

/** SiteLayout consumes the navigation hand-over before home scripts run. */
export const isHomeReturn = () => document.documentElement.hasAttribute('data-header-persistent');

/** Every portrait layer chooses the same profile for the current visit and viewport. */
export const currentPortraitTiming = () => portraitTiming(isHomeReturn(), isPhone());

/** Persist early skips so a later-loaded typing controller also starts with complete prose. */
export function skipHomeIntro(hero: HTMLElement) {
  hero.setAttribute('data-intro-skipped', '');
  hero.dispatchEvent(new Event(openingEvents.skip));
}

// Elements the page-level opening reaches into across components, marked with `data-opening-part`.
// Each component animates its own internals; the output check confirms these markers exist.
export const openingParts = ['contacts', 'topics', 'work-heading', 'work-entry', 'about'] as const;

type OpeningPart = (typeof openingParts)[number];

export const part = (name: OpeningPart) => `[data-opening-part="${name}"]`;

/** Animation groups the home opening starts at different moments. */
export type HomeOpeningGroup =
  | 'frame'
  | 'identity'
  | 'actions'
  | 'work'
  | 'about'
  | 'footer'
  | `lane-${number}`
  | `work-entry-${number}`;
