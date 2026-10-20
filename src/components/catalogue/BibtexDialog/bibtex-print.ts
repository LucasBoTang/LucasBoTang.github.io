/** Printing starts as the box opens; each line adds a base time and a time per character. */
const TIMING = { start: 200, line: 14, character: 0.5 };

/** Prints `text` into `code` line by line, and restores the plain text once it is all in, or when
 * the returned function is called. */
export function printBibtex(code: HTMLElement, text: string) {
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
