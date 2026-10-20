import { enhance } from '../../../lib/lifecycle';
import { reducedMotionQuery } from '../../../lib/motion';

// Bib opens the paper's BibTeX as a modal dialog: Close, Escape or a click outside the box closes
// it, and Copy puts the whole entry on the clipboard. The box switches on as a screen does
// (BibtexDialog's styles), and the entry then prints into it as a terminal's output does, line
// after line behind a block cursor. Every line holds its place from the start, so the box never
// grows as it fills.

/** In milliseconds: printing starts as the box has nearly opened; each line takes `line`, and
 * `character` more for each of its characters. Copy shows that it has copied for `copied`. */
const TIMING = {
  start: 200,
  line: 14,
  character: 0.5,
  copied: 1600,
};

/** Prints `text` into `code` line by line, and restores the plain text once it is all in, or when
 * the returned function is called. */
function printBibtex(code: HTMLElement, text: string) {
  const lines = text.split('\n');
  const spans = lines.map(() => document.createElement('span'));
  code.replaceChildren(
    ...spans.flatMap((span, i) => (i ? [document.createTextNode('\n'), span] : [span])),
  );
  const cursor = document.createElement('span');
  cursor.className = 'bibtex-cursor';
  // When each line starts printing, and when the last has printed.
  const starts: number[] = [];
  let at = TIMING.start;
  for (const line of lines) {
    starts.push(at);
    at += TIMING.line + line.length * TIMING.character;
  }
  const startedAt = performance.now();
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    code.textContent = text;
  };
  const draw = (now: number) => {
    const elapsed = now - startedAt;
    if (elapsed >= at) return stop();
    lines.forEach((line, i) => {
      const end = starts[i + 1] ?? at;
      const shown =
        elapsed >= end
          ? line.length
          : Math.max(0, Math.floor(((elapsed - starts[i]) / (end - starts[i])) * line.length));
      spans[i].textContent = line.slice(0, shown);
      if (elapsed >= starts[i] && elapsed < end) spans[i].append(cursor);
    });
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return stop;
}

function setupBibtex(item: HTMLElement) {
  const openButton = item.querySelector<HTMLButtonElement>('[aria-controls]');
  const dialog = item.querySelector('dialog');
  const code = dialog?.querySelector('code');
  if (!openButton || !dialog || !code || typeof dialog.showModal !== 'function') return;
  const text = code.textContent ?? '';
  const reducedMotion = reducedMotionQuery();
  item.hidden = false;

  let stopPrinting: (() => void) | undefined;
  let session = 0;
  const finishPrinting = () => {
    stopPrinting?.();
    stopPrinting = undefined;
  };
  openButton.addEventListener('click', () => {
    session++;
    finishPrinting();
    dialog.removeAttribute('data-closing');
    dialog.showModal();
    if (!reducedMotion.matches) stopPrinting = printBibtex(code, text);
  });
  dialog.addEventListener('close', () => {
    session++;
    finishPrinting();
    dialog.removeAttribute('data-closing');
  });
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    finishPrinting();
    if (dialog.hasAttribute('data-closing')) dialog.close();
  });

  /** Folds the box away, then closes it. */
  const close = () => {
    if (!dialog.open || dialog.hasAttribute('data-closing')) return;
    finishPrinting();
    if (reducedMotion.matches) return dialog.close();
    dialog.setAttribute('data-closing', '');
    const closingSession = session;
    const finishClosing = () => {
      if (session === closingSession && dialog.hasAttribute('data-closing')) dialog.close();
    };
    // The box may have no animation, or lose it when the motion preference changes.
    // Unlike animationend, `finished` also settles (by rejecting) when it is cancelled.
    const animation = dialog
      .getAnimations()
      .find(
        (animation) =>
          animation instanceof CSSAnimation && animation.animationName === 'bibtex-off',
      );
    if (animation) void animation.finished.then(finishClosing, finishClosing);
    else finishClosing();
  };
  // Escape folds the box away too, instead of closing it at once.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.querySelector('[data-bibtex-close]')?.addEventListener('click', close);
  // A click outside the box lands on the dialog itself, through its backdrop.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  const copy = dialog.querySelector<HTMLButtonElement>('[data-bibtex-copy]');
  const status = dialog.querySelector<HTMLElement>('[data-bibtex-status]');
  if (!copy) return;
  // Without the clipboard, the entry can still be selected by hand.
  if (!navigator.clipboard?.writeText) {
    copy.remove();
    return;
  }
  let resetCopyTimer = 0;
  const resetCopy = () => {
    window.clearTimeout(resetCopyTimer);
    copy.removeAttribute('data-copied');
    copy.setAttribute('aria-label', 'Copy BibTeX');
    if (status) status.textContent = '';
  };
  dialog.addEventListener('close', resetCopy);
  copy.addEventListener('click', async () => {
    const copyingSession = session;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    if (!dialog.open || session !== copyingSession) return;
    finishPrinting();
    copy.setAttribute('data-copied', '');
    copy.setAttribute('aria-label', 'Copied');
    if (status) status.textContent = 'BibTeX copied';
    window.clearTimeout(resetCopyTimer);
    resetCopyTimer = window.setTimeout(resetCopy, TIMING.copied);
  });
}

enhance('[data-bibtex]', setupBibtex);
