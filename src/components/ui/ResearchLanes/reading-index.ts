import { enhance, onScrollFrame } from '../../../lib/lifecycle';

// Mark the section above the reading line with aria-current. Use the first before any
// section reaches it, and the last at the page bottom even if that section is short.

const READING_LINE_RATIO = 0.4;

enhance('[data-reading-index]', (indexNavigation) => {
  const sectionLinks = [...indexNavigation.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const sections = sectionLinks.map((link) =>
    document.getElementById(decodeURIComponent(link.hash.slice(1))),
  );
  let activeIndex = -1;

  const update = () => {
    const line = innerHeight * READING_LINE_RATIO;
    let currentSectionIndex = 0;
    sections.forEach((section, i) => {
      if (section && section.getBoundingClientRect().top <= line) currentSectionIndex = i;
    });
    const root = document.documentElement;
    if (innerHeight + scrollY >= root.scrollHeight - 2) currentSectionIndex = sections.length - 1;
    if (currentSectionIndex === activeIndex) return;
    activeIndex = currentSectionIndex;
    sectionLinks.forEach((link, i) =>
      i === currentSectionIndex
        ? link.setAttribute('aria-current', 'location')
        : link.removeAttribute('aria-current'),
    );
  };
  onScrollFrame(update);
  update();
});
