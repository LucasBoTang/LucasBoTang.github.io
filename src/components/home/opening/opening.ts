// Milliseconds from the start of the home opening, unless a key says it is a duration.
export const openingTiming = {
  /** The pixel picture develops, light parts first, between these moments. */
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
  /** The research lanes swell in slowly once the affiliation above them is in, so the right
   * column reads from the top, and from top to bottom: the first at `laneDelay`, the others
   * their `laneOffsets` later. A lane's dim field opens from its centre over `laneField`, its
   * words drifting from `laneDrift`; its light swells in `laneLightDelay` after it starts, over
   * `laneLight`. The introduction starts typing as the first lane opens. */
  laneDelay: 1600,
  laneOffsets: [0, 140, 280],
  laneField: 1100,
  laneDrift: 220,
  laneLightDelay: 450,
  laneLight: 1150,
  /** The framing comes after the portrait, as the name settles: the site header fades in and the
   * affiliation arrives at `frameAt`. The name's signal marks fade in as its letters start to
   * decode. */
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

// Events the hero dispatches so the page opening can follow the typed introduction.
export const openingEvents = {
  introStart: 'home:intro-start',
  introComplete: 'home:intro-complete',
  skip: 'home:skip-opening',
} as const;

// Elements the page-level opening reaches into across components, marked with `data-opening-part`.
// Each component animates its own internals; the output check confirms these markers exist.
export const openingParts = ['contacts', 'topics', 'work-heading', 'work-entry', 'about'] as const;

type OpeningPart = (typeof openingParts)[number];

export const part = (name: OpeningPart) => `[data-opening-part="${name}"]`;

/** Animation groups the home opening starts at different moments. */
export type HomeOpeningGroup =
  'identity' | 'actions' | 'work' | 'about' | 'footer' | `lane-${number}` | `work-entry-${number}`;
