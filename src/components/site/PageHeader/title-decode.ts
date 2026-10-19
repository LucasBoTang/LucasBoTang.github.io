import { CALM_STEPS, DECODE_ECHO, decodeNoise, seeded } from '../../../lib/decode';
import { enhance } from '../../../lib/lifecycle';
import { reducedMotionQuery } from '../../../lib/motion';
import { slipDuration } from '../../../lib/signal';

// Moving between pages, the page title rewrites itself in place, the way the home name decodes.
// The last page's title stands where this one's will (PageHeader's inline script writes it there
// before the page first shows, and the view transition keeps it out of the leaving page), so the
// title seems never to leave. Then the signal slips once, and the letters break into noise from
// left to right, jumping, flickering and crossed by blocks as the home name's letters are
// (src/lib/decode.ts), and calm and lock into this page's title, each with a two-pixel echo, a
// little out of order. When the length changes, the title takes its new length first, from its
// end, so no gap ever opens inside the word: letters the new title has no room for break and drop
// off from the end inward, and letters it needs grow out of the end as noise, both at once. From
// a page without a title, every letter grows out of noise.

/** Stray characters a breaking letter jumps through: letters only, near in width and in the case
 * of the letter it becomes, so the title's shape holds as they change. */
const NOISE = { lower: 'abcdeghknopqrsuvxyz', upper: 'ABCDEGHKNOPRSUVXYZ' };
/** The last title holds this long before the first letter breaks, so the hand-over from the last
 * page cannot be seen. With no last title, the letters wait instead until the last page has
 * nearly gone, as motion.css keeps the title hidden until then. */
const HOLD = 60;
const WAIT = 240;
/** Letters break this far apart, from left to right. */
const STAGGER = 32;
/** A breaking letter changes character this often, as the home name's letters do. */
const STEP = 45;
/** A letter locks this long after it breaks, up to `JITTER` more, so letters lock a little out of
 * order. */
const SETTLE = 170;
const JITTER = 110;
/** At the end of the word, letters drop off or grow out this far apart, and a dropping letter
 * shows as noise this long before it goes, so the title reaches its new length early. */
const EDGE_STAGGER = 28;
const DROP = 90;
/** Each letter's offset in the decode signal's cycle, in steps. */
const PHASE = 3;

function setupTitleDecode(title: HTMLElement) {
  const text = title.querySelector<HTMLElement>('.title-signal');
  const from = title.dataset.titleFrom ?? '';
  const to = title.getAttribute('aria-label') ?? '';
  const settle = () => {
    if (text) text.textContent = to;
    title.removeAttribute('data-title-from');
  };
  if (!text || from === to || reducedMotionQuery().matches) {
    settle();
    return;
  }

  const count = Math.max(from.length, to.length);
  const hold = from ? HOLD : WAIT;
  const letters = Array.from({ length: count }, (_, index) => {
    const glyph = document.createElement('span');
    glyph.className = 'title-decode-glyph';
    const settles = hold + index * STAGGER + SETTLE + seeded(index) * JITTER;
    // A letter the new title has no room for drops off from the end inward; one it adds grows out
    // of the end; one both titles share breaks in turn from the left.
    const dropping = index >= to.length;
    const breaks = dropping
      ? hold + (from.length - 1 - index) * EDGE_STAGGER
      : index >= from.length
        ? hold + (index - from.length) * EDGE_STAGGER
        : hold + index * STAGGER;
    return {
      glyph,
      from: from[index] ?? '',
      to: to[index] ?? '',
      breaks,
      locks: dropping ? breaks + DROP : settles,
    };
  });
  text.replaceChildren(...letters.map(({ glyph }) => glyph));

  const startedAt = performance.now();
  const end = Math.max(...letters.map(({ locks }) => locks)) + DECODE_ECHO;
  let slipped = false;
  const draw = (now: number) => {
    const elapsed = now - startedAt;
    if (elapsed >= end) {
      settle();
      return;
    }
    // The signal slips as the first letter breaks, showing slices of the new title for a moment.
    if (!slipped && elapsed >= hold) {
      slipped = true;
      text.setAttribute('data-slip', '');
      window.setTimeout(() => text.removeAttribute('data-slip'), slipDuration());
    }
    letters.forEach(({ glyph, from, to, breaks, locks }, index) => {
      const shape = to || from;
      const characters = shape !== shape.toLowerCase() ? NOISE.upper : NOISE.lower;
      const broken = elapsed >= breaks;
      const locked = elapsed >= locks;
      const decoding = broken && !locked;
      const step = Math.floor((elapsed - breaks) / STEP);
      const calm = decoding ? Math.min(1, Math.ceil((locks - elapsed) / STEP) / CALM_STEPS) : 0;
      // Letters break close together, so each is offset in the signal's cycle: neighbours never
      // blink or flash on the same step and no hole opens in the word.
      const noise = decodeNoise(index, step + index * PHASE, calm);
      glyph.textContent = locked
        ? to
        : broken
          ? characters[Math.floor(seeded(index * 97 + step) * characters.length)]
          : from;
      glyph.toggleAttribute('data-noise', decoding);
      glyph.toggleAttribute('data-blink', decoding && noise.blink);
      glyph.toggleAttribute('data-echo', locked && elapsed < locks + DECODE_ECHO && to !== '');
      glyph.style.opacity = decoding ? String(noise.opacity) : '';
      glyph.style.transform = decoding ? `translateY(${noise.hop}em)` : '';
      const block = decoding ? noise.block : undefined;
      if (block) {
        glyph.dataset.block = block.tone;
        glyph.style.setProperty('--block-top', `${block.top}em`);
        glyph.style.setProperty('--block-height', `${block.height}em`);
      } else glyph.removeAttribute('data-block');
    });
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

enhance('[data-title-from]', setupTitleDecode);
