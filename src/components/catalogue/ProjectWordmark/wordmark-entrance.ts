/** The word switches on this long after its entry starts to arrive, once the entry has landed
 * and stilled and held a moment, so arriving and switching on read as two beats. It powers on as a tube does, fast
 * and hard, over `POWER_ON` milliseconds: a hot sliver at the middle of the letters shoots out into
 * a line (0–90ms), which flickers as the current comes up (90–130ms); the picture springs open from
 * it, overshooting, overexposed and soft (130–250ms), cools to its own blue (to 480ms), and catches
 * twice more, with a jolt sideways, before the signal holds (400–550ms). `HANDOVER` is the share of
 * it after which the beam has become the word. */
export const POWER_ON_DELAY = 800;
export const POWER_ON = 650;
/** A word that arrives out of sight waits dark until this share of it can be seen, and powers on
 * `IN_VIEW_BEAT` milliseconds after, so it is never switched on where no one is looking. */
export const IN_VIEW_SHARE = 0.6;
export const IN_VIEW_BEAT = 300;
export const HANDOVER = 0.3;
// Reuse identical tube states without changing the authored offsets or easing.
const fullBeam = { opacity: 1, transform: 'scaleX(1)' };
const settledPicture = { opacity: 1, transform: 'none', filter: 'brightness(1) blur(0px)' };

export const BEAM_FRAMES: Keyframe[] = [
  { opacity: 0, transform: 'scaleX(0.03)' },
  { opacity: 1, transform: 'scaleX(0.03)', offset: 0.04, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
  { ...fullBeam, offset: 0.14, easing: 'steps(1, end)' },
  { ...fullBeam, opacity: 0.5, offset: 0.16, easing: 'steps(1, end)' },
  { ...fullBeam, offset: 0.18 },
  { ...fullBeam, offset: 0.2, easing: 'ease-in' },
  { opacity: 0, transform: 'scaleX(1) scaleY(3)', offset: HANDOVER },
  { opacity: 0, transform: 'scaleX(1) scaleY(3)' },
];
export const PICTURE_FRAMES: Keyframe[] = [
  { opacity: 0, transform: 'scaleY(0.02)', filter: 'brightness(2.2) blur(1.5px)' },
  { opacity: 0, transform: 'scaleY(0.02)', offset: 0.2 },
  {
    opacity: 1,
    transform: 'scaleY(0.02)',
    filter: 'brightness(2.2) blur(1.5px)',
    offset: 0.21,
    easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
  },
  { opacity: 1, transform: 'scaleY(1.12)', offset: 0.32, easing: 'ease-in-out' },
  { opacity: 1, transform: 'scaleY(0.96)', offset: 0.38, easing: 'ease-out' },
  { opacity: 1, transform: 'none', filter: 'brightness(1.4) blur(0.5px)', offset: 0.46 },
  // The tube cools to its own blue, catching twice as the signal settles: a flash with a jolt
  // sideways, then a dimmer flicker.
  {
    opacity: 1,
    transform: 'none',
    filter: 'brightness(1.15) blur(0.2px)',
    offset: 0.6,
    easing: 'steps(1, end)',
  },
  {
    opacity: 1,
    transform: 'translateX(1px)',
    filter: 'brightness(1.7) blur(0px)',
    offset: 0.62,
    easing: 'steps(1, end)',
  },
  { opacity: 1, transform: 'none', filter: 'brightness(1.1) blur(0px)', offset: 0.66 },
  {
    ...settledPicture,
    offset: 0.74,
    easing: 'steps(1, end)',
  },
  {
    ...settledPicture,
    opacity: 0.7,
    offset: 0.8,
    easing: 'steps(1, end)',
  },
  { ...settledPicture, offset: 0.84 },
  settledPicture,
];
/** The faint echo beside the word: it flares as the picture opens, then settles to its rest. */
export const ECHO_FRAMES: Keyframe[] = [
  { opacity: 0 },
  { opacity: 0, offset: 0.28 },
  { opacity: 0.35, offset: 0.34 },
  { opacity: 0.1, offset: 0.7 },
  { opacity: 0.1 },
];
