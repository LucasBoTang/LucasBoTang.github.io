import { seeded } from '../../../lib/random.ts';

// Pure keystroke planning: word tempo, phrase pauses and one corrected slip, with no DOM work.

/** A keystroke within a word, in milliseconds, before the word's tempo and a little scatter; the
 * scatter is this share of it either way. */
const KEY = 24;
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
const NOTICE = 200;
const BACKSPACE = [75, 60];
const BREATH = 100;
const CAREFUL = 1.3;
const RECOVER = 1.12;
const RECOVERY = 0.5;
export interface TypingRhythm {
  /** An opening may choose a slightly quicker keystroke than the shared page pace. */
  keyDelay?: number;
  /** Pauses between phrases. */
  sentencePause?: number;
  commaPause?: number;
  /** Pauses before chosen words, in milliseconds. */
  thinkBefore?: Record<string, number>;
  /** One word whose last two letters are transposed, then corrected. */
  slipWord?: string;
  /** Scale only the correction's pauses to suit a faster passage; ordinary typing is unchanged. */
  slipPace?: number;
}

/** One moment of the typing: from `at` milliseconds, `count` letters show, and, while `swapped`
 * is set, the letters at `swapped` and the one after it show the wrong way round. */
export interface Keystroke {
  at: number;
  count: number;
  swapped?: number;
}

/** The keystrokes that type `text`, the same on every visit. */
export function planTyping(text: string, rhythm: TypingRhythm): Keystroke[] {
  const strokes: Keystroke[] = [];
  let at = 0;
  let tempo = 1;
  let recovering = 1;
  let n = 0;
  const slipPace = rhythm.slipPace ?? 1;
  const key = (share: number) => {
    const scatter = 1 + (seeded(n++) * 2 - 1) * SCATTER;
    return (rhythm.keyDelay ?? KEY) * share * tempo * recovering * scatter;
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
    const word = ending ? token.slice(0, -ending.length) : token;
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
      at += (NOTICE + BACKSPACE[0]) * slipPace;
      strokes.push({ at, count: count - 1, swapped });
      at += BACKSPACE[1] * slipPace;
      strokes.push({ at, count: count - 2 });
      at += BREATH * slipPace + key(CAREFUL);
      strokes.push({ at, count: count - 1 });
      at += key(CAREFUL);
      strokes.push({ at, count });
      recovering = RECOVER;
    } else recovering += (1 - recovering) * RECOVERY;
    for (let i = 0; i < ending.length; i++) {
      at += key(1);
      strokes.push({ at, count: ++count });
    }
    if (/[.!?]$/.test(token)) at += rhythm.sentencePause ?? 0;
    else if (/[,;:]$/.test(token)) at += rhythm.commaPause ?? 0;
  }
  return strokes;
}
