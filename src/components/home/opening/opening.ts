// Home opening timings. Portrait times are milliseconds after the identity
// starts (after the desktop greeting, immediately on phones); other keys name their durations.
export const openingTiming = {
  /** The portrait's first dots arrive at `formStart`; the frame's affiliation uses the same
   * delay. The pixel picture develops, light parts first, through `formEnd`. */
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
  /** The home introduction types slightly faster than page leads, at its own readable pace. */
  typingKey: 17,
  /** The ordinary greeting keeps its existing cadence on phones. */
  greetingKey: 22,
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
  /** A fresh desktop greeting rests at title size, then folds into its reserved paragraph.
   * The frame joins the fold; the bio starts on landing and leads the portrait. */
  greetingRest: 200,
  greetingFold: 600,
  greetingEasing: 'cubic-bezier(.22,.75,.25,1)',
  /** The frame joins the fold; its affiliation keeps its existing `formStart` delay. */
  greetingFrame: 80,
  /** Let the fresh desktop lanes begin just before the bio's final keystroke. */
  laneLead: 120,
  /** Let the fresh desktop portrait settle before the research lanes open. */
  portraitRest: 720,
  /** Bounded fallback for a stalled greeting, including a background tab. */
  greetingLimit: 5000,
  thinkBefore: { reliable: 80, reusable: 100 },
  slipWord: 'scalable',
  sentencePause: 200,
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
