import { writeAttribute } from './sign-surface';

// The dots of the i's in "Decisions", knocked out of the collision's impact. Each flies up and out to
// its own side, then bounces in to stop on its place, losing speed at every bounce. A dot rolls as
// it goes; the font's dots are rounded blocks, not circles, so its centre rises over each corner
// to keep its lowest edge on the same floor.

/** Distances in sign units, times in seconds. */
const flight = {
  gravity: 900,
  /** Each dot's speed upwards as it is knocked out, in order. */
  launch: [170, 140],
  /** How much speed a bounce keeps, upwards and along. */
  restitution: 0.56,
  slide: 0.9,
  bounces: 4,
};
/** A dot's outline is sampled at this many points, and its rolling worked out in these steps. */
const CONTOUR_POINTS = 96;
const TURN_STEP = 0.01;

/**
 * A flight from (`x`, `y`), relative to the dot's place, that leaves upwards at `launch` and
 * bounces in to stop on the spot.
 */
function bounceIn(x: number, y: number, launch: number) {
  const { gravity, restitution, slide, bounces } = flight;
  // The vertical motion alone sets each hop's length: first the fall from the launch, then the
  // rebounds, each lower than the last.
  const fall = (launch + Math.sqrt(launch * launch - 2 * gravity * y)) / gravity;
  const hops = [{ start: 0, duration: fall, y, vy: -launch }];
  let rebound = (gravity * fall - launch) * restitution;
  for (let bounce = 0; bounce < bounces; bounce++) {
    const last = hops[hops.length - 1];
    hops.push({
      start: last.start + last.duration,
      duration: (2 * rebound) / gravity,
      y: 0,
      vy: -rebound,
    });
    rebound *= restitution;
  }
  // The speed along slows at each bounce; it is chosen so the last hop ends on the spot.
  const along = hops.reduce((sum, hop, i) => sum + hop.duration * slide ** i, 0);
  const speed = -x / along;
  const last = hops[hops.length - 1];
  return {
    /** How long the flight lasts, in milliseconds. */
    duration: (last.start + last.duration) * 1000,
    /** Where the dot is, relative to its place, `ms` milliseconds into the flight. */
    at(ms: number) {
      const seconds = ms / 1000;
      let dx = x;
      for (const [i, hop] of hops.entries()) {
        const t = Math.min(Math.max(seconds - hop.start, 0), hop.duration);
        dx += speed * slide ** i * t;
        if (seconds < hop.start + hop.duration)
          return { dx, dy: hop.y + hop.vy * t + 0.5 * gravity * t * t };
      }
      return { dx: 0, dy: 0 };
    },
  };
}

/**
 * How `dot`, centred on (`cx`, `cy`), rolls over up to `reach` sign units: `spin` is 1 for a dot
 * heading left, which turns anticlockwise, and -1 for one heading right.
 */
function rolling(dot: SVGPathElement, cx: number, cy: number, reach: number, spin: number) {
  const length = dot.getTotalLength();
  const xs = new Float64Array(CONTOUR_POINTS);
  const ys = new Float64Array(CONTOUR_POINTS);
  for (let point = 0; point < CONTOUR_POINTS; point++) {
    const p = dot.getPointAtLength((length * point) / CONTOUR_POINTS);
    xs[point] = p.x - cx;
    ys[point] = p.y - cy;
  }
  /** How far below the centre the dot reaches when turned through `angle`. */
  const support = (angle: number) => {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    let lowest = -Infinity;
    for (let point = 0; point < CONTOUR_POINTS; point++)
      lowest = Math.max(lowest, xs[point] * sin + ys[point] * cos);
    return lowest;
  };
  // The distance covered by each step of the turn, worked out once; each step's far end is the
  // next step's near end.
  const distances = [0];
  const angles = [0];
  for (let distance = 0, angle = 0, near = support(0); distance < reach;) {
    const far = support(angle + spin * TURN_STEP);
    distance += ((near + far) / 2) * TURN_STEP;
    angle += spin * TURN_STEP;
    near = far;
    distances.push(distance);
    angles.push(angle);
  }
  return {
    support,
    /** The angle the dot has turned through with `distance` left to cover. */
    turnAt(distance: number) {
      if (distance <= 0) return 0;
      const last = distances.length - 1;
      if (distance >= distances[last]) return angles[last];
      // The first step that reaches `distance`, found by halving.
      let low = 1;
      let high = last;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (distances[middle] >= distance) high = middle;
        else low = middle + 1;
      }
      const share = (distance - distances[low - 1]) / (distances[low] - distances[low - 1]);
      return angles[low - 1] + (angles[low] - angles[low - 1]) * share;
    },
  };
}

/** The `dots`, knocked out from `from`, in sign units. */
export function createDots(dots: SVGPathElement[], from: { x: number; y: number }) {
  const flights = dots.map((dot, index) => {
    const box = dot.getBBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const x = from.x - cx;
    return {
      dot,
      cx,
      cy,
      floor: box.height / 2,
      path: bounceIn(x, from.y - cy, flight.launch[index] ?? flight.launch[0]),
      roll: rolling(dot, cx, cy, Math.abs(x) + 2, x > 0 ? 1 : -1),
    };
  });

  return {
    /** How long the last dot takes to land, in milliseconds. */
    duration: Math.max(0, ...flights.map(({ path }) => path.duration)),
    /** Places the dots `age` milliseconds after they are knocked out; until then they are hidden. */
    place(age: number) {
      for (const { dot, cx, cy, floor, path, roll } of flights) {
        writeAttribute(dot, 'opacity', age < 0 ? '0' : '1');
        let dx = 0;
        let dy = 0;
        let angle = 0;
        if (age >= 0 && age < path.duration) {
          ({ dx, dy } = path.at(age));
          // The dot turns with the distance it travels, not with a separately eased spin.
          const radians = roll.turnAt(Math.abs(dx));
          angle = (radians * 180) / Math.PI;
          dy += floor - roll.support(radians);
        }
        writeAttribute(dot, 'transform', `translate(${dx} ${dy}) rotate(${angle} ${cx} ${cy})`);
      }
    },
    /** Shows the dots in place. */
    still() {
      for (const { dot } of flights) {
        writeAttribute(dot, 'transform', null);
        writeAttribute(dot, 'opacity', '1');
      }
    },
  };
}
