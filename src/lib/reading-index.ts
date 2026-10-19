import { enhance } from './lifecycle';

// A reading index: the links inside an element marked `data-reading-index` point at sections of the
// page, and the link to the section being read is marked `aria-current="location"`. A section is
// being read once its top has passed the reading line, two fifths of the way down the window, until
// the next one passes it. Above the first section, the first is being read; at the foot of the
// page, the last is, however short.

const READING_LINE = 0.4;

enhance('[data-reading-index]', (index) => {
  const links = [...index.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const sections = links.map((link) =>
    document.getElementById(decodeURIComponent(link.hash.slice(1))),
  );
  let frame = 0;

  const update = () => {
    frame = 0;
    const line = innerHeight * READING_LINE;
    let current = 0;
    sections.forEach((section, i) => {
      if (section && section.getBoundingClientRect().top <= line) current = i;
    });
    const root = document.documentElement;
    if (innerHeight + scrollY >= root.scrollHeight - 2) current = sections.length - 1;
    links.forEach((link, i) =>
      i === current
        ? link.setAttribute('aria-current', 'location')
        : link.removeAttribute('aria-current'),
    );
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();
});
