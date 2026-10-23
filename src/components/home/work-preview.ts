import { enhance } from '../../lib/lifecycle.ts';
import { reducedMotionQuery, watchActivity } from '../../lib/motion.ts';

// Ignore passing pointers; a deliberate pause crossfades the word into the complete figure.
const INTENT_DELAY = 240;
// Match WorkPreview.astro: 140ms delay + 1200ms rise; retain the full 1000ms exit tail.
const HANDOVER = 1340;
const RELEASE = 1000;

const plates = [...document.querySelectorAll<HTMLElement>('[data-figure-preview]')];
// One display width for all three artworks. The tallest composition sets the limit;
// the other two keep their own aspect ratios and sit in the centre of their plates.
// Document bleed protects overhanging artwork; it is not part of the visible composition width.
const fitPreviews = () => {
  const sizes = plates.map((plate) => ({
    plate,
    width: plate.clientWidth,
    // Use the existing row padding for the artwork without changing the document flow.
    height:
      plate.querySelector<HTMLElement>('.work-preview-picture')?.clientHeight || plate.clientHeight,
    sourceWidth: Number(plate.dataset.previewWidth),
    sourceHeight: Number(plate.dataset.previewHeight),
    contentWidth: Number(plate.dataset.previewWidth) - 2 * Number(plate.dataset.previewBleed ?? 0),
  }));
  const displayWidth = Math.min(
    ...sizes.map((s) =>
      Math.min(
        (s.width * s.contentWidth) / s.sourceWidth,
        (s.height * s.contentWidth) / s.sourceHeight,
      ),
    ),
  );
  sizes.forEach(({ plate, contentWidth }) => {
    plate.style.setProperty('--preview-scale', String(displayWidth / contentWidth));
  });
};
const resize = new ResizeObserver(fitPreviews);
plates.forEach((plate) => resize.observe(plate));

enhance<HTMLAnchorElement>('[data-figure-preview]', (link) => {
  const host = link.closest<HTMLElement>('[data-project-host]');
  const picture = link.querySelector<HTMLElement>('.work-preview-picture');
  if (!host || !picture) return;
  const width = Number(link.dataset.previewWidth);
  const height = Number(link.dataset.previewHeight);
  const reduced = reducedMotionQuery();
  let pointed = false;
  let onScreen = false;
  let active = false;
  let ready = false;
  let frame: HTMLIFrameElement | undefined;
  let intentTimer = 0;
  let handover = 0;
  let release = 0;

  const show = () => {
    if (!active || !ready) return;
    link.setAttribute('data-preview-visible', '');
    clearTimeout(handover);
    handover = window.setTimeout(
      () => {
        link.removeAttribute('data-preview-pending');
      },
      reduced.matches ? 0 : HANDOVER,
    );
  };
  const unload = () => {
    frame?.remove();
    frame = undefined;
    ready = false;
    link.removeAttribute('data-preview-pending');
  };
  const load = () => {
    if (!frame) {
      link.setAttribute('data-preview-pending', '');
      const child = document.createElement('iframe');
      child.width = String(width);
      child.height = String(height);
      child.tabIndex = -1;
      child.dataset.homePreview = '';
      child.title = link.getAttribute('aria-label') ?? 'Research preview';
      child.addEventListener(
        'load',
        () => {
          if (frame !== child) return;
          child.contentDocument?.documentElement.setAttribute('data-home-preview', '');
          ready = true;
          show();
        },
        { once: true },
      );
      child.src = link.dataset.previewSrc! + '?preview=home';
      frame = child;
      picture.append(child);
    }
  };
  const update = () => {
    const focused = host.hasAttribute('data-focused') || host.matches(':has(:focus-visible)');
    const next = onScreen && !document.hidden && (pointed || focused);
    if (next === active) return;
    active = next;
    clearTimeout(intentTimer);
    clearTimeout(handover);
    clearTimeout(release);
    if (!active) {
      link.removeAttribute('data-preview-visible');
      release = window.setTimeout(unload, reduced.matches ? 0 : RELEASE);
      return;
    }
    // Reuse an exiting or loading document, reversing its CSS transition in place.
    if (frame) {
      show();
      return;
    }
    intentTimer = window.setTimeout(load, reduced.matches ? 0 : INTENT_DELAY);
  };
  host.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    pointed = true;
    update();
  });
  host.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return;
    pointed = false;
    update();
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
    update();
  });
  host.addEventListener('focusin', update);
  host.addEventListener('focusout', () => requestAnimationFrame(update));
  new MutationObserver(update).observe(host, {
    attributes: true,
    attributeFilter: ['data-focused'],
  });
  watchActivity(link, ({ inView }) => {
    onScreen = inView.size > 0;
    update();
  });
});
