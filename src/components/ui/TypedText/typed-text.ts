import { seeded } from '../../../lib/decode';
import { createLoop } from '../../../lib/loop';
import { openingPending } from '../../../lib/opening-gate';

// Types the host introduction once the opening allows it, as a person types it rather than as a
// machine does. Letters come in bursts, quickest within a word and quicker still on common pairs;
// a word's first letter is a touch slower, as the hand moves; and the tempo drifts from word to
// word, so the pace gathers and eases over the sentence instead of jittering letter by letter.
// The writer stops to choose the sentence's key words, longest before the last. Once, at speed,
// two letters come out swapped: the word is finished, the slip noticed, two quick backspaces, a
// breath, the letters retyped with care, and the typing picks up again. Every visit sees the same
// writer. The sentence's letters are laid out from the start and only revealed, so the paragraph
// never reflows as it types.

/** A keystroke within a word, in milliseconds, before the word's tempo and a little scatter; the
 * scatter is this share of it either way. */
const KEY = 62;
const SCATTER = 0.14;
/** Within a word, a common letter pair comes at this share of a keystroke, and a word's first
 * letter at this share; a space takes this share. */
const PAIR = 0.85;
const WORD_START = 1.15;
const SPACE = 1.25;
const COMMON_PAIRS = new Set(
  'th he in er an re on at en nd ti es or te of ed is it al ar st to nt ng se ha as ou io le ve co me de hi ri ro ic ne ea ra ce li ch ll be ma si om ur'.split(
    ' ',
  ),
);
/** Each word's tempo moves this far towards a fresh one, between `TEMPO`, so the pace drifts. */
const TEMPO = [0.92, 1.08];
const TEMPO_DRIFT = 0.3;
/** The slip: in this word, its last two letters come out swapped. The writer notices after
 * `NOTICE`, deletes them `BACKSPACE` apart, the second quicker, breathes `BREATH`, retypes them
 * slower by `CAREFUL`, and comes back to speed from `RECOVER`, closing `RECOVERY` of the way back
 * with each word. */
const NOTICE = 260;
const BACKSPACE = [95, 75];
const BREATH = 150;
const CAREFUL = 1.3;
const RECOVER = 1.12;
const RECOVERY = 0.5;
/** Once no key has moved for this long, in milliseconds, the cursor starts to blink. */
const STILL = 160;

export interface TypingRhythm {
  /** Pauses before chosen words, in milliseconds. */
  thinkBefore?: Record<string, number>;
  /** One word whose last two letters are transposed, then corrected. */
  slipWord?: string;
}

/** One moment of the typing: from `at` milliseconds, `count` letters show, and, while `swapped`
 * is set, the letters at `swapped` and the one after it show the wrong way round. */
interface Keystroke {
  at: number;
  count: number;
  swapped?: number;
}

/** Splits `text` into hidden letter spans inside `into`, keeping each word unbroken. */
function spell(text: string, into: HTMLElement): HTMLElement[] {
  const letters: HTMLElement[] = [];
  for (const token of text.match(/\S+|\s+/g) ?? []) {
    const word = document.createElement('span');
    if (token.trim()) word.className = 'intro-word';
    for (const character of token) {
      const letter = document.createElement('span');
      letter.className = 'intro-letter';
      letter.textContent = character;
      letter.setAttribute('data-unseen', '');
      word.append(letter);
      letters.push(letter);
    }
    into.append(word);
  }
  return letters;
}

/** The keystrokes that type `text`, the same on every visit. */
function plan(text: string, rhythm: TypingRhythm): Keystroke[] {
  const strokes: Keystroke[] = [];
  let at = 0;
  let tempo = 1;
  let recovering = 1;
  let n = 0;
  const key = (share: number) => {
    const scatter = 1 + (seeded(n++) * 2 - 1) * SCATTER;
    return KEY * share * tempo * recovering * scatter;
  };
  const words = text.match(/\S+|\s+/g) ?? [];
  let count = 0;
  let slipped = false;
  for (const token of words) {
    if (!token.trim()) {
      at += key(SPACE);
      strokes.push({ at, count: (count += token.length) });
      continue;
    }
    const bare = token.toLowerCase().replace(/[^a-z]/g, '');
    at += rhythm.thinkBefore?.[bare] ?? 0;
    tempo += (TEMPO[0] + seeded(n++) * (TEMPO[1] - TEMPO[0]) - tempo) * TEMPO_DRIFT;
    const slip = !slipped && bare === rhythm.slipWord && bare.length >= 2;
    // Correct the word before typing its trailing punctuation.
    const ending = slip ? (token.match(/[.,!?;:]+$/)?.[0] ?? '') : '';
    const word = token.slice(0, token.length - ending.length);
    const start = count;
    for (let i = 0; i < word.length; i++) {
      const pair = i > 0 && COMMON_PAIRS.has(word.slice(i - 1, i + 1).toLowerCase());
      at += key(i === 0 ? WORD_START : pair ? PAIR : 1);
      count++;
      // The slip types the last two letters the wrong way round.
      const swapped = slip && i >= word.length - 2 ? start + word.length - 2 : undefined;
      strokes.push({ at, count, swapped });
    }
    if (slip) {
      slipped = true;
      const swapped = count - 2;
      at += NOTICE;
      at += BACKSPACE[0];
      strokes.push({ at, count: count - 1, swapped });
      at += BACKSPACE[1];
      strokes.push({ at, count: count - 2 });
      at += BREATH;
      at += key(CAREFUL);
      strokes.push({ at, count: count - 1 });
      at += key(CAREFUL);
      strokes.push({ at, count });
      recovering = RECOVER;
    } else recovering += (1 - recovering) * RECOVERY;
    for (let i = 0; i < ending.length; i++) {
      at += key(1);
      strokes.push({ at, count: ++count });
    }
  }
  return strokes;
}

interface TypingOptions extends TypingRhythm {
  held?: () => boolean;
  onStart?: () => void;
  onComplete?: () => void;
}

/** Types one pre-laid-out sentence; its host decides when it may run. */
export function createTyping(host: HTMLElement, options: TypingOptions = {}) {
  const target = host.querySelector<HTMLElement>('[data-intro-typed]');
  const original = host.querySelector<HTMLElement>('.intro-copy');
  if (!target || !original) return { setRunning: () => {}, finish: () => {} };
  const cursor = host.querySelector<HTMLElement>('.intro-cursor');
  const text = original.textContent?.trim() ?? '';
  const letters = spell(text, target);
  const strokes = plan(text, options);

  let swappedAt: number | undefined;
  const show = ({ count, swapped }: Pick<Keystroke, 'count' | 'swapped'>) => {
    letters.forEach((letter, i) => letter.toggleAttribute('data-unseen', i >= count));
    // The slip trades the two letters' characters, which keeps the word's width, so the line
    // never moves.
    if (swappedAt !== swapped) {
      for (const at of [swappedAt, swapped])
        if (at !== undefined) {
          const [first, second] = [letters[at], letters[at + 1]];
          [first.textContent, second.textContent] = [second.textContent, first.textContent];
        }
      swappedAt = swapped;
    }
    if (!cursor) return;
    // Before the first letter the cursor waits in the line itself, not inside a hidden letter.
    (count > 0 ? letters[count - 1] : target).append(cursor);
    cursor.toggleAttribute('data-at-start', count === 0);
  };
  show({ count: 0 });
  host.setAttribute('data-typing-ready', '');

  let complete = false;
  let next = 0;
  let started = false;
  // Wait while SiteLayout's gate is up or the page holds the introduction back, so the first
  // letter, and the reading cue it fires, always follow the opening's listeners.
  const loop = createLoop(
    (elapsed) => {
      let stroke: Keystroke | undefined;
      while (next < strokes.length && strokes[next].at <= elapsed) stroke = strokes[next++];
      if (stroke) {
        if (!started) {
          started = true;
          host.setAttribute('data-typing-started', '');
          options.onStart?.();
        }
        show(stroke);
        // Like a real caret, the cursor holds steady while keys move and blinks once they stop.
        host.setAttribute('data-typing', '');
      } else if (next > 0 && elapsed - strokes[next - 1].at > STILL)
        host.removeAttribute('data-typing');
      if (next >= strokes.length) finish();
    },
    () => (options.held?.() ?? false) || openingPending(),
  );

  /** Shows the whole sentence at once and reports the introduction as complete. */
  function finish() {
    if (complete) return;
    complete = true;
    loop.stop();
    host.removeAttribute('data-typing');
    show({ count: letters.length });
    host.setAttribute('data-typing-complete', '');
    options.onComplete?.();
  }

  /** Starts or pauses typing; has no effect once the introduction is complete. */
  function setRunning(enabled: boolean) {
    host.toggleAttribute('data-typing-suspended', !enabled);
    if (complete) return;
    if (enabled) loop.start();
    else loop.stop();
  }

  return { setRunning, finish };
}
