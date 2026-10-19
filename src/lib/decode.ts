// The decode signal shared by the home name and the page titles: how an unlocked letter looks
// from step to step. It jumps above its place, flickers, blinks out now and then, and solid blocks
// flash over it; over its last steps it calms, so it is drawn into place rather than stopped.

/** A block flashing over a letter, as em from the top of its line and a tone; `ink` erases. */
type DecodeBlock = { top: number; height: number; tone: 'blue' | 'light' | 'ink' };
const BLOCKS: DecodeBlock[] = [
  { top: 0.22, height: 0.36, tone: 'blue' },
  { top: 0.62, height: 0.14, tone: 'light' },
  { top: 0.46, height: 0.1, tone: 'ink' },
  { top: 0.74, height: 0.2, tone: 'blue' },
];
/** Heights above the letter's place in em, cycled as it jumps. */
const HOPS = [-0.3, -0.1, 0.06, -0.22, 0.02, -0.14];
/** A letter calms over this many steps before it locks. */
export const CALM_STEPS = 6;
/** A block flashes every `BLOCK_EVERY` steps and the letter blinks out every `BLINK_EVERY`. */
const BLOCK_EVERY = 4;
const BLINK_EVERY = 7;
/** The echo beside a letter that has just locked lasts this long, in milliseconds. */
export const DECODE_ECHO = 90;

/** Repeatable numbers in [0, 1), so every decode of the same text looks the same. */
export const seeded = (n: number) => {
  const value = Math.sin(n * 91.345 + 47.853) * 43758.5453;
  return value - Math.floor(value);
};

/**
 * How the letter at `index` looks at `step` of its decode, `calm` (1 to 0) of the way from noise
 * to locked: its jump in em, its opacity, whether it blinks out, and the block over it, if any.
 */
export function decodeNoise(index: number, step: number, calm: number) {
  return {
    hop: HOPS[(index + step) % HOPS.length] * calm,
    opacity: 1 - (0.55 - 0.4 * seeded(index * 13 + step)) * calm,
    blink: step % BLINK_EVERY === BLINK_EVERY - 1,
    block:
      step % BLOCK_EVERY === BLOCK_EVERY - 1 ? BLOCKS[(index + step) % BLOCKS.length] : undefined,
  };
}
