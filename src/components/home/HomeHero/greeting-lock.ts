/** Hold page interactions for the short desktop greeting while its resources prepare. Browser
 * shortcuts remain available. The entrance releases this on landing or its bounded fallback. */
export function lockGreeting() {
  const root = document.documentElement;
  const controls = [
    ...document.querySelectorAll<HTMLElement>(
      'a, button, input, select, textarea, [tabindex], summary',
    ),
  ].filter((element) => !element.inert);
  root.style.setProperty('--greeting-scrollbar', `${window.innerWidth - root.clientWidth}px`);
  root.dataset.greetingLocked = '';
  controls.forEach((element) => (element.inert = true));
  const block = (event: Event) => {
    if (event instanceof KeyboardEvent && (event.metaKey || event.ctrlKey || event.altKey)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const events = ['keydown', 'wheel', 'touchmove'] as const;
  events.forEach((type) =>
    document.addEventListener(type, block, { capture: true, passive: false }),
  );
  let released = false;
  return () => {
    if (released) return;
    released = true;
    delete root.dataset.greetingLocked;
    root.style.removeProperty('--greeting-scrollbar');
    if (!root.getAttribute('style')) root.removeAttribute('style');
    controls.forEach((element) => (element.inert = false));
    events.forEach((type) => document.removeEventListener(type, block, true));
  };
}
