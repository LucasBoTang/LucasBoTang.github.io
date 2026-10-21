import { enhance } from './lifecycle';
import { reducedMotionQuery } from './motion';
import { waitForOpeningVisible } from './opening-gate';
import { waitForPageReady } from './page-ready';

/** Brief activation feedback; the browser still follows the link immediately. */
enhance('[data-navigation-feedback]', (navigation) => {
  const header = navigation.closest('header') ?? navigation;
  const currentLink = navigation.querySelector('a[aria-current="page"]');
  const holdCurrentHover = () => {
    // Chrome may not restore :hover across documents until its first pointer event. Hold the
    // current label in advance; actual pointer movement or leaving releases it below.
    currentLink?.setAttribute('data-hover-hold', '');
  };
  void waitForPageReady().then(async () => {
    await waitForOpeningVisible();
    // Home fades its header in after the portrait. Wait for that actual entrance, so a pointer
    // already over a link cannot start a second animation on top of it.
    await Promise.allSettled(header.getAnimations().map((animation) => animation.finished));
    holdCurrentHover();
    header.setAttribute('data-hover-ready', '');
  });
  const clear = () => {
    navigation.querySelectorAll('[data-nav-connect], [data-hover-hold]').forEach((link) => {
      link.removeAttribute('data-nav-connect');
      link.removeAttribute('data-hover-hold');
    });
  };
  navigation.addEventListener('click', (event) => {
    if (!(event instanceof MouseEvent) || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(link instanceof HTMLAnchorElement) || !navigation.contains(link)) return;
    if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const to = new URL(link.href);
    if (to.origin !== location.origin || to.hash || reducedMotionQuery().matches) return;
    clear();
    link.setAttribute('data-nav-connect', '');
  });
  navigation.addEventListener('pointerout', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    if (!link || !navigation.contains(link)) return;
    if (event.relatedTarget instanceof Node && link.contains(event.relatedTarget)) return;
    link.removeAttribute('data-hover-hold');
  });
  navigation.addEventListener('pointermove', (event) => {
    if (!(event instanceof PointerEvent) || (!event.movementX && !event.movementY)) return;
    currentLink?.removeAttribute('data-hover-hold');
  });
  // Keep the choice settled while navigation commits, including a slow response. Clearing its
  // marker at animationend would restart the hover roll underneath the pointer.
  // A departing page may be frozen mid-pulse. Back restores its settled current-page colour.
  addEventListener('pageshow', () => {
    clear();
    if (header.hasAttribute('data-hover-ready')) holdCurrentHover();
  });
});
