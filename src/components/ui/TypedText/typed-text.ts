import { createLoop } from '../../../lib/loop';
import { openingPending } from '../../../lib/opening-gate';
import { planTyping, type Keystroke, type TypingRhythm } from './typing-rhythm';

export type { TypingRhythm } from './typing-rhythm';

// Render a preplanned passage without reflow: letters reserve their final positions, and the
// caret follows cached coordinates. The host controls viewport activity and opening cues.

/** Once no key has moved for this long, in milliseconds, the cursor starts to blink. */
const STILL = 160;

/** Splits `text` into hidden letter spans inside `into`, keeping each word unbroken. */
function spell(text: string, into: HTMLElement, breakAt = 0): HTMLElement[] {
  const letters: HTMLElement[] = [];
  let line = into;
  for (const token of text.match(/\S+|\s+/g) ?? []) {
    if (breakAt > 0 && letters.length === breakAt) {
      line = document.createElement('span');
      line.className = 'typed-line';
      into.append(line);
    }
    const word = document.createElement('span');
    if (token.trim()) word.className = 'typed-word';
    for (const character of token) {
      const letter = document.createElement('span');
      letter.className = 'typed-letter';
      letter.textContent = character;
      letter.setAttribute('data-unseen', '');
      word.append(letter);
      letters.push(letter);
    }
    line.append(word);
  }
  return letters;
}

interface TypingOptions extends TypingRhythm {
  /** Report one phrase as it is typed; showing completed text directly never plays the cue. */
  cue?: { after: string; onReach: () => void };
  /** Runs once near the end on the active typing clock; direct completion skips this cue. */
  endCue?: { lead: number; onReach: () => void };
  /** Develop newly typed letters without changing their geometry or the keystroke clock. */
  letterFade?: number;
  /** A page introduction may type beside its title while the body is still being prepared. */
  duringOpening?: boolean;
  held?: () => boolean;
  onComplete?: () => void;
}

/** Types one pre-laid-out sentence; its host decides when it may run. */
export function createTyping(host: HTMLElement, options: TypingOptions = {}) {
  const target = host.querySelector<HTMLElement>('[data-typed-run]');
  const original = host.querySelector<HTMLElement>('.typed-copy');
  if (!target || !original) return { setRunning: () => {}, finish: () => {}, remeasure: () => {} };
  const cursor = host.querySelector<HTMLElement>('.typed-cursor');
  // TypedText puts the live copy and its caret in this shared layer.
  const layer = target.parentElement!;
  const text = original.textContent?.trim() ?? '';
  const letters = spell(text, target, Number(host.dataset.mobileBreakAt) || 0);
  const strokes = planTyping(text, options);
  const duration = strokes.at(-1)?.at ?? 0;
  let endCue = options.endCue;
  const cueStart = options.cue?.after ? text.indexOf(options.cue.after) : -1;
  const cueAt = cueStart >= 0 ? cueStart + options.cue!.after.length : Infinity;
  const letterFade = options.letterFade ?? 0;
  if (letterFade) {
    host.dataset.typingFade = '';
    host.style.setProperty('--typing-letter-fade', `${letterFade}ms`);
  }

  let shown = 0;
  let positions: { x: number; y: number }[] | undefined;
  let swappedAt: number | undefined;
  // Measure the fixed sentence once, after fonts are ready. The caret stays in one DOM parent;
  // translating it between cached positions avoids laying the paragraph out on every key.
  const moveCursor = () => {
    if (!cursor) return;
    if (!shown) {
      cursor.style.transform = 'translate(0px, 0px)';
      return;
    }
    if (!positions) {
      const origin = layer.getBoundingClientRect();
      // A host may scale its whole typing layer during an entrance. Cache local coordinates so
      // the caret inherits that transform exactly once, including while the sentence resizes.
      const scale = origin.width / parseFloat(getComputedStyle(layer).width) || 1;
      positions = letters.map((letter) => {
        const box = letter.getBoundingClientRect();
        return { x: (box.right - origin.left) / scale, y: (box.top - origin.top) / scale };
      });
    }
    const position = positions[shown - 1];
    cursor.style.transform = `translate(${position.x.toFixed(2)}px, ${position.y.toFixed(2)}px)`;
  };
  const show = ({ count, swapped }: Pick<Keystroke, 'count' | 'swapped'>) => {
    for (let i = Math.min(shown, count); i < Math.max(shown, count); i++)
      letters[i].toggleAttribute('data-unseen', i >= count);
    shown = count;
    // The slip trades the two letters' characters, which keeps the word's width, so the line
    // never moves.
    if (swappedAt !== swapped) {
      for (const at of [swappedAt, swapped])
        if (at !== undefined) {
          const [first, second] = [letters[at], letters[at + 1]];
          [first.textContent, second.textContent] = [second.textContent, first.textContent];
        }
      swappedAt = swapped;
      // Home's rare typo changes shaping. Refresh only when it appears or is corrected, keeping
      // exact caret alignment even if the sentence was resized during the mistake.
      positions = undefined;
    }
    moveCursor();
  };
  show({ count: 0 });
  host.dataset.typingReady = '';
  const remeasure = () => {
    positions = undefined;
    moveCursor();
  };
  new ResizeObserver(remeasure).observe(host);
  void document.fonts.ready.then(remeasure);

  let complete = false;
  let next = 0;
  let started = false;
  let revealedAt = 0;
  let cued = false;
  // Home follows its opening gate and reading cues. A page introduction may explicitly start
  // beside its title while that gate still protects the body.
  const loop = createLoop(
    (elapsed) => {
      let stroke: Keystroke | undefined;
      while (next < strokes.length && strokes[next].at <= elapsed) stroke = strokes[next++];
      if (stroke) {
        if (!started) {
          started = true;
          host.dataset.typingStarted = '';
        }
        show(stroke);
        revealedAt = elapsed;
        if (!cued && stroke.count >= cueAt) {
          cued = true;
          options.cue?.onReach();
        }
        // Like a real caret, the cursor holds steady while keys move and blinks once they stop.
        host.dataset.typing = '';
      } else if (next > 0 && elapsed - strokes[next - 1].at > STILL) delete host.dataset.typing;
      if (endCue && elapsed >= duration - endCue.lead) {
        endCue.onReach();
        endCue = undefined;
      }
      if (next >= strokes.length && elapsed >= revealedAt + letterFade) finish();
    },
    () => (options.held?.() ?? false) || (!options.duringOpening && openingPending()),
  );

  /** Shows the whole sentence at once and reports the introduction as complete. */
  function finish() {
    if (complete) return;
    complete = true;
    loop.stop();
    delete host.dataset.typingFade;
    host.style.removeProperty('--typing-letter-fade');
    if (!host.style.length) host.removeAttribute('style');
    delete host.dataset.typing;
    show({ count: letters.length });
    host.dataset.typingComplete = '';
    options.onComplete?.();
  }

  /** Toggles typing and caret activity; completed passages never type again. */
  function setRunning(enabled: boolean) {
    host.toggleAttribute('data-typing-suspended', !enabled);
    if (complete) return;
    if (enabled) loop.start();
    else loop.stop();
  }

  return { setRunning, finish, remeasure };
}
