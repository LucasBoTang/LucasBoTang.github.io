import { enhance } from '../../../lib/lifecycle.ts';
import { reducedMotionQuery, watchActivity } from '../../../lib/motion.ts';
import { observePreviewLayout } from './preview-layout.ts';
import { createPreviewOpeningGate } from './preview-opening.ts';

// Ignore passing pointers; deliberate intent tunes the standby wordmark into a figure.
const INTENT_DELAY_MS = 240;
// Give a newly arrived wordmark a readable moment before it can become a preview.
const WORDMARK_REST_MS = 400;
// Match WorkPreview.astro: 40ms delay + 380ms tone rise + 100ms clear hold.
const HANDOVER_MS = 520;
// The wordmark returns after 80ms, over 240ms; only then discard the picture.
const RELEASE_MS = 320;

function setupPreview(
  link: HTMLAnchorElement,
  opening: ReturnType<typeof createPreviewOpeningGate>,
) {
  const host = link.closest<HTMLElement>('[data-project-host]');
  const signal = link.querySelector<HTMLElement>('.work-preview-signal');
  if (!host || !signal) return;
  const width = Number(link.dataset.previewWidth);
  const height = Number(link.dataset.previewHeight);
  const reduced = reducedMotionQuery();
  let hovered = false;
  let inView = false;
  let requested = false;
  let loaded = false;
  let connected = false;
  let wordmarkState: 'waiting' | 'arriving' | 'ready' = opening.complete ? 'ready' : 'waiting';
  let iframe: HTMLIFrameElement | undefined;
  let intentTimerId = 0;
  let handoverTimerId = 0;
  let releaseTimerId = 0;

  const revealPreview = () => {
    if (!requested || !loaded) return;
    if (!connected && !reduced.matches) link.setAttribute('data-preview-acquiring', '');
    connected = true;
    link.setAttribute('data-preview-visible', '');
    clearTimeout(handoverTimerId);
    handoverTimerId = window.setTimeout(
      () => {
        link.removeAttribute('data-preview-pending');
        link.removeAttribute('data-preview-acquiring');
      },
      reduced.matches ? 0 : HANDOVER_MS,
    );
  };
  const unloadPreview = () => {
    iframe?.remove();
    iframe = undefined;
    loaded = false;
    connected = false;
    link.removeAttribute('data-preview-pending');
    link.removeAttribute('data-preview-acquiring');
  };
  const loadPreview = () => {
    if (!iframe) {
      link.setAttribute('data-preview-pending', '');
      const child = document.createElement('iframe');
      child.width = String(width);
      child.height = String(height);
      child.tabIndex = -1;
      child.title = link.getAttribute('aria-label') ?? 'Research preview';
      child.addEventListener(
        'load',
        () => {
          if (iframe !== child) return;
          child.contentDocument?.documentElement.setAttribute('data-home-preview', '');
          loaded = true;
          revealPreview();
        },
        { once: true },
      );
      // The same address as the figure's embed and warm-up, so one copy serves all three.
      child.src = link.dataset.previewSrc!;
      iframe = child;
      signal.append(child);
    }
  };
  const waitForWordmark = () => {
    if (wordmarkState !== 'waiting' || !opening.complete || !inView || document.hidden) return;
    wordmarkState = 'arriving';
    // These are the row's own arrival animations. A cancellation also settles the row,
    // as the site's keyboard and reduced-motion skips restore its natural appearance.
    const arrivals = host.getAnimations?.() ?? [];
    void Promise.allSettled(arrivals.map((animation) => animation.finished)).then(() => {
      const settle = () => {
        wordmarkState = 'ready';
        updatePreview();
      };
      if (reduced.matches) settle();
      else window.setTimeout(settle, WORDMARK_REST_MS);
    });
  };
  const updatePreview = () => {
    waitForWordmark();
    const focused = host.hasAttribute('data-focused') || host.matches(':has(:focus-visible)');
    const next = wordmarkState === 'ready' && inView && !document.hidden && (hovered || focused);
    if (next === requested) return;
    requested = next;
    clearTimeout(intentTimerId);
    clearTimeout(handoverTimerId);
    clearTimeout(releaseTimerId);
    if (!requested) {
      link.removeAttribute('data-preview-visible');
      link.removeAttribute('data-preview-acquiring');
      releaseTimerId = window.setTimeout(unloadPreview, reduced.matches ? 0 : RELEASE_MS);
      return;
    }
    // Reuse an exiting or loading document, reversing its CSS transition in place.
    if (iframe) {
      revealPreview();
      return;
    }
    intentTimerId = window.setTimeout(loadPreview, reduced.matches ? 0 : INTENT_DELAY_MS);
  };
  if (!opening.complete) opening.onComplete(updatePreview);
  host.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    hovered = true;
    updatePreview();
  });
  host.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return;
    hovered = false;
    updatePreview();
  });
  // A touch that lands on the word opens its preview; a subsequent tap follows the link.
  // Keyboard activation and modified mouse clicks retain native link behaviour.
  let previewTap = false;
  link.addEventListener('pointerdown', (event) => {
    previewTap = event.pointerType === 'touch' && !link.hasAttribute('data-preview-visible');
  });
  link.addEventListener('pointercancel', () => {
    previewTap = false;
  });
  link.addEventListener('click', (event) => {
    if (!previewTap || event.detail === 0) return;
    previewTap = false;
    event.preventDefault();
    host.setAttribute('data-focused', '');
    updatePreview();
  });
  host.addEventListener('focusin', updatePreview);
  host.addEventListener('focusout', () => requestAnimationFrame(updatePreview));
  new MutationObserver(updatePreview).observe(host, {
    attributes: true,
    attributeFilter: ['data-focused'],
  });
  watchActivity(link, (activity) => {
    inView = activity.inView.size > 0;
    updatePreview();
  });
}

const opening = createPreviewOpeningGate();
observePreviewLayout([...document.querySelectorAll<HTMLElement>('[data-figure-preview]')]);
enhance<HTMLAnchorElement>('[data-figure-preview]', (link) => setupPreview(link, opening));
