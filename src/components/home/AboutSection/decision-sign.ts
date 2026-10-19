import { enhance } from '../../../lib/lifecycle';
import { createLoop } from '../../../lib/loop';
import { watchActivity } from '../../../lib/motion';
import { openingPending } from '../../../lib/opening-gate';
import { createBand } from './sign-band';
import { createCollision } from './sign-collision';
import { createDots } from './sign-dots';
import { createSurface } from './sign-surface';
import { createSwitch } from './sign-switch';

// The About sign: a field of pixels with lettering cut out of it, in one colour throughout.
// 1. The three research fields are written in, row by row, then hold a moment for reading. A
//    narrow band sweeps across them again and again (sign-band.ts), from partway through the
//    writing, so that its first sweep finishes with it, until they give way to the slogan.
// 2. The fields scramble away into solid pixels while a flickering front writes "Decisions" in
//    from left to right (sign-switch.ts). As soon as both are done, "Scalable" and "Reliable"
//    collide (sign-collision.ts): the impact knocks the dots of "Decisions" out to either side,
//    to bounce into place (sign-dots.ts), ripples through its letters, and bursts the plus out of
//    the gap.
// 3. The slogan holds, then the pixels go out in a spiral, and the cycle begins again.
// The svg's `data-sign-state` names the current step. With reduced motion the fields stand still.

/** The cycle, in milliseconds. */
const timing = {
  /** The fields are written in over this long, then hold whole for reading. */
  write: 1800,
  read: 1500,
  /** From the impact, the slogan holds this long before the pixels go out. */
  sloganHold: 2600,
  extinguish: 2600,
  darkPause: 400,
};
/** Frames are painted at most this often. */
const PAINT_INTERVAL = 1000 / 60;
/** The sign waits while the home opening holds its section below this opacity. */
const HIDDEN_OPACITY = 0.05;

function setupDecisionSign(svg: SVGSVGElement) {
  const surface = createSurface(svg);
  const slogan = svg.querySelector<SVGGElement>('.slogan-lettering');
  const fields = svg.querySelector<SVGGElement>('.research-lettering');
  const lines = fields?.querySelector<SVGPathElement>('.research-lines');
  if (!surface || !slogan || !fields || !lines) return;
  const { full } = surface;

  // Without scripts the slogan stays hidden; from here, clips switch between it and the fields.
  const showSlogan = surface.clip(slogan, 'slogan');
  const showFields = surface.clip(fields, 'fields');
  showSlogan('');
  slogan.removeAttribute('display');

  const collision = createCollision(slogan);
  if (!collision) return;
  const band = createBand(lines, surface);
  const switchover = createSwitch(surface);
  const dots = createDots(
    Array.from(slogan.querySelectorAll<SVGPathElement>('.slogan-dot')),
    collision.centre,
  );

  const bandAt = Math.max(0, timing.write - band.duration);
  const rewriteAt = timing.write + timing.read;
  const rewriteEnd = rewriteAt + switchover.duration;
  const impact = rewriteEnd + collision.impactAt;
  const vanishAt = impact + timing.sloganHold;
  const darkAt = vanishAt + timing.extinguish;
  const cycle = darkAt + timing.darkPause;
  /** Each state, with the time it lasts until. */
  const states: [string, number][] = [
    ['writing', timing.write],
    ['fields', rewriteAt],
    ['switching', rewriteEnd],
    ['colliding', impact + dots.duration],
    ['slogan', vanishAt],
    ['extinguishing', darkAt],
    ['dark', cycle],
  ];

  /** Paints the sign at `phase` milliseconds into the cycle. */
  const paint = (phase: number) => {
    svg.dataset.signState = states.find(([, until]) => phase < until)?.[0];
    let lit =
      phase < timing.write
        ? surface.writing(phase / timing.write)
        : phase < vanishAt
          ? full
          : surface.spiral((phase - vanishAt) / timing.extinguish);
    if (phase < rewriteAt || phase >= rewriteEnd) {
      showSlogan(phase < rewriteAt ? '' : full);
      showFields(phase < rewriteAt ? full : '');
    } else {
      const cells = switchover.at(phase - rewriteAt);
      showSlogan(cells.slogan);
      showFields(cells.fields);
      lit = cells.lit;
    }
    surface.light(lit);
    band.place(phase - bandAt, rewriteAt - bandAt);
    collision.place(phase - rewriteEnd);
    dots.place(phase - impact);
  };

  // The sign waits, dark, until the home opening has shown its section; once shown, it stays shown,
  // so the section's style is no longer read on every frame.
  const section = svg.closest<HTMLElement>('[data-opening-part="about"]');
  let shown = false;
  const hiddenByOpening = () => {
    shown ||=
      !openingPending() &&
      (section === null || Number(getComputedStyle(section).opacity) >= HIDDEN_OPACITY);
    return !shown;
  };
  let lastPaint = -Infinity;
  const loop = createLoop((elapsed) => {
    // Frame times are coarse, so a millisecond's slack keeps every frame at the display's rate.
    if (elapsed - lastPaint < PAINT_INTERVAL - 1) return;
    lastPaint = elapsed;
    paint(elapsed % cycle);
  }, hiddenByOpening);

  watchActivity(svg, (activity) => {
    if (activity.reduced) {
      loop.stop();
      surface.light(full);
      showFields(full);
      showSlogan('');
      band.still();
      collision.still();
      dots.still();
    } else if (!activity.hidden && activity.inView.size > 0) loop.start();
    else loop.stop();
  });
}

enhance('[data-decision-sign]', (section) => {
  const svg = section.querySelector<SVGSVGElement>('svg');
  if (svg) setupDecisionSign(svg);
});
