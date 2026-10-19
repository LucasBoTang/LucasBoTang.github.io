import { writeAttribute } from './sign-surface';

// The slogan's first line collides into place. "Scalable" and "Reliable" rush in from either side
// and meet where the plus will stand. In order, from the impact:
// - the words squash against each other, the sign jolts, and the dots of "Decisions" are knocked
//   out of the impact (sign-dots.ts);
// - they bounce apart at a share of the speed they came in at, slowing, until each strikes its
//   side of the sign, squashes against it, springs back a little and settles;
// - a ripple runs out from the impact through the letters of "Decisions": each lifts, sinks a
//   little past its place and settles;
// - once the gap has opened, the plus bursts out of it.

/** Times in milliseconds, distances in sign units, speeds in units per millisecond. */
const collision = {
  /** The words accelerate from off the sign to the impact over this long. */
  approach: 420,
  /** Where each word starts, from its place. */
  scalableFrom: -150,
  reliableFrom: 130,
  /** The words leave the impact at this share of the speed they arrived at, and strike their
   * sides with `keep` of the speed they left with. */
  restitution: 0.45,
  keep: 0.6,
  /** A word squashes by this much per unit of speed, over `squashTime`, stretching upright by
   * half as much. */
  squash: 0.06,
  squashTime: 120,
  /** After striking its side, a word springs back inward by this share of its speed times the
   * period, with this period and decay. */
  wallBounce: 0.3,
  wallPeriod: 160,
  wallDecay: 60,
  /** The sign's jolt: its height, then its period and decay. */
  jolt: 0.9,
  joltPeriod: 120,
  joltDecay: 80,
  /** The ripple: each letter springs up with this strength (it peaks a little under 3 units),
   * period and decay. It starts `rippleDelay` after the impact, and `rippleSpread` later for every
   * sign unit a letter stands from the impact. */
  ripple: 5,
  ripplePeriod: 300,
  rippleDecay: 120,
  rippleDelay: 40,
  rippleSpread: 0.8,
  /** The plus bursts this long after the impact, once the gap has opened, and springs to its size. */
  burst: 60,
  plusPeriod: 300,
  plusDecay: 80,
};

/** A decaying oscillation, from 1 (or 0 for `Math.sin`) at `t` = 0. */
const ringing = (t: number, period: number, decay: number, wave = Math.cos) =>
  Math.exp(-t / decay) * wave((2 * Math.PI * t) / period);
/** A squash `t` after a strike, rising and easing back over `squashTime`. */
const pulse = (t: number) =>
  t > 0 && t < collision.squashTime ? Math.sin((Math.PI * t) / collision.squashTime) : 0;

/**
 * How far a word stands from its place, towards the impact, `t` after it: it leaves `contact`
 * away at `restitution` of its arrival `speed`, slows evenly until it strikes its side, then
 * springs back a little. Also gives when it strikes and how fast.
 */
function bounceApart(contact: number, speed: number) {
  const leave = collision.restitution * speed;
  const strike = collision.keep * leave;
  const slowing = (leave * leave - strike * strike) / (2 * contact);
  const strikeAt = (leave - strike) / slowing;
  const spring = (collision.wallBounce * strike * collision.wallPeriod) / (2 * Math.PI);
  return {
    strikeAt,
    strike,
    at: (t: number) =>
      t < strikeAt
        ? contact - leave * t + 0.5 * slowing * t * t
        : spring * ringing(t - strikeAt, collision.wallPeriod, collision.wallDecay, Math.sin),
  };
}

/** The colliding line of `slogan`, or undefined if its markup is missing a part. */
export function createCollision(slogan: SVGGElement) {
  const scalable = slogan.querySelector<SVGPathElement>('.slogan-scalable');
  const plus = slogan.querySelector<SVGPathElement>('.slogan-plus');
  const reliable = slogan.querySelector<SVGPathElement>('.slogan-reliable');
  if (!scalable || !plus || !reliable) return undefined;
  const plusBox = plus.getBBox();
  const centre = { x: plusBox.x + plusBox.width / 2, y: plusBox.y + plusBox.height / 2 };
  const grow = (scale: number) =>
    `translate(${centre.x} ${centre.y}) scale(${scale}) translate(${-centre.x} ${-centre.y})`;

  // At the impact each word has crossed half the gap the plus will fill, at the speed its eased
  // approach ends with.
  const scalableBox = scalable.getBBox();
  const reliableBox = reliable.getBBox();
  const contact = (reliableBox.x - (scalableBox.x + scalableBox.width)) / 2;
  const words = [
    { word: scalable, box: scalableBox, from: collision.scalableFrom, inward: 1 },
    { word: reliable, box: reliableBox, from: collision.reliableFrom, inward: -1 },
  ].map(({ word, box, from, inward }) => {
    const inner = inward > 0 ? box.x + box.width : box.x;
    const outer = inward > 0 ? box.x : box.x + box.width;
    const middle = box.y + box.height / 2;
    const arrival = (3 * Math.abs(contact * inward - from)) / collision.approach;
    /** Squashes the word by `amount` against its edge at `edge`. */
    const squashAt = (edge: number, amount: number) =>
      `translate(${edge} ${middle}) scale(${1 - amount} ${1 + amount / 2}) translate(${-edge} ${-middle})`;
    return {
      word,
      from,
      inward,
      inner,
      outer,
      arrival,
      squashAt,
      apart: bounceApart(contact, arrival),
    };
  });

  const letters = Array.from(
    slogan.querySelectorAll<SVGPathElement>('.decisions-letter'),
    (letter) => {
      const box = letter.getBBox();
      return {
        letter,
        delay:
          collision.rippleDelay +
          Math.abs(box.x + box.width / 2 - centre.x) * collision.rippleSpread,
      };
    },
  );
  /** Places the ripple `since` milliseconds after the impact. */
  const ripple = (since: number) => {
    for (const { letter, delay } of letters) {
      const t = since - delay;
      const lift =
        t > 0
          ? collision.ripple * ringing(t, collision.ripplePeriod, collision.rippleDecay, Math.sin)
          : 0;
      if (Math.abs(lift) > 0.01) writeAttribute(letter, 'transform', `translate(0 ${-lift})`);
      else writeAttribute(letter, 'transform', null);
    }
  };

  return {
    /** Where the plus stands, in sign units. */
    centre,
    /** When the words meet, in milliseconds after they set off. */
    impactAt: collision.approach,
    /** Places the line `t` milliseconds after the words set off. */
    place(t: number) {
      if (t < collision.approach) {
        // Accelerating towards each other, from off the sign to the point of contact.
        const rush = Math.max(0, t / collision.approach) ** 3;
        for (const { word, from, inward } of words)
          writeAttribute(
            word,
            'transform',
            `translate(${from + (contact * inward - from) * rush} 0)`,
          );
        writeAttribute(plus, 'transform', grow(0));
        writeAttribute(slogan, 'transform', null);
        ripple(0);
        return;
      }
      const since = t - collision.approach;
      for (const { word, inward, inner, outer, arrival, squashAt, apart } of words) {
        const struck = collision.squash * arrival * pulse(since);
        const walled = collision.squash * apart.strike * pulse(since - apart.strikeAt);
        writeAttribute(
          word,
          'transform',
          `translate(${apart.at(since) * inward} 0) ${squashAt(inner, struck)} ${squashAt(outer, walled)}`,
        );
      }
      const sinceBurst = since - collision.burst;
      const burst =
        sinceBurst > 0 ? 1 - ringing(sinceBurst, collision.plusPeriod, collision.plusDecay) : 0;
      writeAttribute(plus, 'transform', grow(Math.max(0, burst)));
      const jolt =
        collision.jolt * ringing(since, collision.joltPeriod, collision.joltDecay, Math.sin);
      writeAttribute(slogan, 'transform', `translate(0 ${Math.abs(jolt) > 0.01 ? jolt : 0})`);
      ripple(since);
    },
    /** Shows the line in place. */
    still() {
      for (const part of [scalable, plus, reliable, slogan])
        writeAttribute(part, 'transform', null);
      ripple(0);
    },
  };
}
