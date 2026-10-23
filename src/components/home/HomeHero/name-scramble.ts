import { DECODE_ECHO, decodeCharacter, sampleDecode } from '../../../lib/decode';
import { currentPortraitTiming } from '../opening/opening';

// The name's entrance, as a decode. Each letter is noise until it finds itself: it jumps through
// stray characters, with solid blocks flashing over it and the odd blink (src/lib/decode.ts, the
// signal the page titles decode with too), then closes in through a few characters of a similar
// shape and locks, with a two-pixel blue echo, the same signal as the name's later glitches.
// Letters lock at their own moments, some early and some late; the name is whole when the last
// one locks. Every visit sees the same sequence. The decoding letters are a temporary layer over
// the name; its own text, which carries its accessible name, then takes over.

/** Characters of a similar shape that each letter closes in through before itself. */
const NEAR_SHAPES: Record<string, string> = {
  B: 'PR8',
  o: 'ce0',
  T: 'IY7',
  a: 'edo',
  n: 'ruh',
  g: 'q9y',
};
const FALLBACK_SHAPES = 'ilo';
/** Stray characters a letter jumps through before it closes in. */
const NOISE = 'BOTANGbotang0123#/+*';

/** Each character holds this long; letters appear this far apart, from left to right. */
const STAGGER = 55;
/** When each letter locks, in milliseconds from `openingTiming.tearStart`, by its position. */
const LOCKS = [280, 430, 590, 360, 510, 660];
/** A lock for a letter past the end of `LOCKS`. */
const lockAt = (index: number) => LOCKS[index] ?? LOCKS[LOCKS.length - 1] + index * STAGGER;
/** The finished letters stay this long over the name's own text, which appears beneath them, so
 * no frame shows neither. */
const OVERLAP = 150;

/** How long the decode lasts from `openingTiming.tearStart`, for a name of `letters` letters. */
export const nameScrambleDuration = (letters: number) =>
  Math.max(0, ...Array.from({ length: letters }, (_, index) => lockAt(index))) + DECODE_ECHO;

/** Decodes the letters of `.name-base` inside `name` into place. */
export function createNameScramble(name: HTMLElement) {
  const time = currentPortraitTiming();
  const base = name.querySelector<HTMLElement>('.name-base');
  let frame = 0;
  let layer: HTMLElement | undefined;

  const finish = () => {
    cancelAnimationFrame(frame);
    layer?.remove();
    layer = undefined;
  };

  /** Starts with the opening; the letters begin at `openingTiming.tearStart`. */
  const play = () => {
    const text = base?.firstChild;
    if (!text || text.nodeType !== Node.TEXT_NODE) return;
    const content = text.textContent ?? '';
    layer = document.createElement('span');
    layer.className = 'name-scramble';
    layer.setAttribute('aria-hidden', 'true');
    const letters: {
      at: number;
      char: string;
      near: string;
      glyph: HTMLElement;
      block: HTMLElement;
    }[] = [];
    for (let at = 0; at < content.length; at++) {
      const char = content[at];
      if (/\s/.test(char)) continue;
      const glyph = document.createElement('span');
      glyph.className = 'name-scramble-glyph';
      const block = document.createElement('span');
      block.className = 'name-scramble-block';
      block.style.visibility = 'hidden';
      layer.append(glyph, block);
      letters.push({ at, char, near: NEAR_SHAPES[char] ?? FALLBACK_SHAPES, glyph, block });
    }
    name.append(layer);

    // The letters are placed over the name's own, as it is laid out: kerning sets letters closer
    // than they would stand alone. Until the font has arrived, which can move them, every frame
    // places them again; after that, once is enough.
    const range = document.createRange();
    // Every box is measured before any is moved, so the frame lays out the name only once.
    const place = () => {
      const origin = name.getBoundingClientRect();
      const boxes = letters.map(({ at }) => {
        range.setStart(text, at);
        range.setEnd(text, at + 1);
        return range.getBoundingClientRect();
      });
      letters.forEach(({ glyph, block }, i) => {
        glyph.style.left = block.style.left = `${boxes[i].left - origin.left}px`;
        block.style.width = `${boxes[i].width}px`;
      });
    };

    let placed = false;
    const startedAt = performance.now();
    const end = nameScrambleDuration(letters.length);
    const draw = (now: number) => {
      const elapsed = now - startedAt - time.tearStart;
      if (elapsed >= end + OVERLAP) {
        finish();
        return;
      }
      if (elapsed >= 0 && !placed) {
        place();
        placed = document.fonts.status === 'loaded';
      }
      letters.forEach(({ char, near, glyph, block }, index) => {
        const appear = index * STAGGER;
        if (elapsed < appear) return;
        const lock = lockAt(index);
        const { locked, step, toLock, noise } = sampleDecode(index, elapsed, appear, lock);
        // The final steps close in through shapes chosen for the home name.
        const closing = !locked && toLock <= near.length;
        const shown = locked
          ? char
          : closing
            ? near[near.length - toLock]
            : decodeCharacter(index, step, NOISE);
        const blink = !locked && !closing && noise.blink;
        glyph.textContent = blink ? '' : shown;
        glyph.style.opacity = String(noise.opacity);
        glyph.style.transform = `translateY(${noise.hop}em)`;
        glyph.toggleAttribute('data-light', !locked);
        glyph.toggleAttribute('data-echo', locked && elapsed < lock + DECODE_ECHO);
        const flash = locked ? undefined : noise.block;
        block.style.visibility = flash ? 'visible' : 'hidden';
        if (flash) {
          const { top, height, tone } = flash;
          block.style.top = `${top}em`;
          block.style.height = `${height}em`;
          block.dataset.tone = tone;
        }
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
  };

  return { play, finish };
}
