// Home opening timings. Portrait times are milliseconds after the identity
// starts (after the desktop greeting, immediately on phones); other keys name their durations.
export const openingTiming = {
  /** The portrait's first dots and affiliation start at `formStart`, releasing the bio once
   * greeted. The pixel picture develops, light parts first, through `formEnd`. */
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
  typingKey: 20,
  /** The greeting has a barely slower cadence before the introduction continues. */
  greetingKey: 22,
  thinkBefore: { reliable: 80, reusable: 100 },
  slipWord: 'scalable',
  cursorRest: 300,
  sentencePause: 200,
  commaPause: 80,
  /** On a site return, the lanes join this long after the prose starts fading in. */
  returnLaneDelay: 120,
  /** The research lanes follow the affiliation by the shared arrival beat, each `laneOffsets`
   * later. A lane's field opens from its centre over `laneField`, starts drifting at `laneDrift`,
   * and its light swells in `laneLightDelay` after it starts, over `laneLight`. */
  laneOffsets: [0, 140, 280],
  laneField: 1200,
  laneDrift: 160,
  laneLightDelay: 200,
  laneLight: 1250,
  /** The research action joins the first light with a short fade. */
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
  /** The opening starts once the portrait's images have decoded, or after this long regardless. */
  readyTimeout: 1000,
} as const;

// Events the hero dispatches so the page opening can follow the introduction.
export const openingEvents = {
  greetingComplete: 'home:greeting-complete',
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
  'identity' | 'actions' | 'work' | 'about' | 'footer' | `lane-${number}` | `work-entry-${number}`;
