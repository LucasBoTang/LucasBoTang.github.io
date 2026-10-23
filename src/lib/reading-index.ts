import { enhance, onScrollFrame } from './lifecycle';

// Mark the section above the reading line with aria-current. Use the first before any
// section reaches it, and the last at the page bottom even if that section is short.

const READING_LINE = 0.4;

enhance('[data-reading-index]', (index) => {
  const links = [...index.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const sections = links.map((link) =>
    document.getElementById(decodeURIComponent(link.hash.slice(1))),
  );
  let activeIndex = -1;

  const update = () => {
    const line = innerHeight * READING_LINE;
    let current = 0;
    sections.forEach((section, i) => {
      if (section && section.getBoundingClientRect().top <= line) current = i;
    });
    const root = document.documentElement;
    if (innerHeight + scrollY >= root.scrollHeight - 2) current = sections.length - 1;
    if (current === activeIndex) return;
    activeIndex = current;
    links.forEach((link, i) =>
      i === current
        ? link.setAttribute('aria-current', 'location')
        : link.removeAttribute('aria-current'),
    );
  };
  onScrollFrame(update);
  update();
});
