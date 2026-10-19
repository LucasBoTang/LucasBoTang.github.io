// Pages load in full; the site has no client-side router. Module scripts run once, after the
// document is parsed, and never tear down: leaving discards the page, and the back-forward cache
// freezes timers, frames and observers, then resumes them as they were.

/** Calls `setup` once for each element matching `selector`. */
export function enhance<T extends Element = HTMLElement>(
  selector: string,
  setup: (element: T) => void,
): void {
  document.querySelectorAll<T>(selector).forEach(setup);
}
