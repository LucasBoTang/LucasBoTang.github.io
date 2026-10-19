// The sign's pixel surface: its grid of cells, the clips that cut cells out of a layer, and the mask
// that decides which pixels are lit. Every path is in the sign's own units.

const SVG = 'http://www.w3.org/2000/svg';
/** The writing lights this many cells at a time; the spiral puts out tiles this many cells wide. */
const WRITE_STEP = 4;
const TILE = 3;

/** Repeatable numbers in [0, 1), so every cycle looks the same. */
export const hash = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const written = new WeakMap<Element, Map<string, string | null>>();
/** Sets an attribute, or removes it for `null`, skipping a value it already has, so a frame that
 * moves nothing writes nothing. */
export function writeAttribute(element: Element, name: string, value: string | null) {
  let attributes = written.get(element);
  if (!attributes) written.set(element, (attributes = new Map()));
  if (attributes.get(name) === value) return;
  attributes.set(name, value);
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/** Sets a path's `d`, skipping values it already has. */
const pathSetter = (path: SVGPathElement) => {
  let shown: string | undefined;
  return (d: string) => {
    if (d === shown) return;
    shown = d;
    path.setAttribute('d', d);
  };
};

/**
 * The surface of `svg`: a `rect` painted with a `pattern` whose tile is one pixel cell, seen
 * through the `mask` that cuts the lettering out of it, all the size of the `viewBox`. The pixels
 * that are lit are drawn into that same mask, under the lettering: one mask, never one inside
 * another, as Safari on phones leaves out the inner of two nested masks while the outer changes,
 * so the lettering would only appear once the writing stopped.
 */
export function createSurface(svg: SVGSVGElement) {
  const defs = svg.querySelector('defs');
  const pattern = svg.querySelector('pattern');
  const mask = svg.querySelector('mask');
  const painted = svg.querySelector<SVGRectElement>(':scope > rect');
  if (!defs || !pattern || !mask || !painted) return undefined;
  const { width, height } = svg.viewBox.baseVal;
  const pitch = pattern.width.baseVal.value;
  const columns = Math.ceil(width / pitch);
  const rows = Math.ceil(height / pitch);
  const full = `M0 0H${width}V${height}H0Z`;
  const prefix = mask.id;

  /** A position `cells` cells along, rounded so paths stay short. */
  const at = (cells: number) => Math.round(cells * pitch * 1000) / 1000;
  /** Columns `from` to `to` of `row`. */
  const span = (row: number, from: number, to: number) =>
    `M${at(from)} ${at(row)}H${at(to)}V${at(row + 1)}H${at(from)}Z`;

  // Which pixels are lit at all: white in the mask, then darkened outside the sign's shape, which
  // the mask's first path draws, and beneath the lettering, which the mask goes on to draw.
  const shape = mask.querySelector<SVGPathElement>(':scope > path');
  if (!shape) return undefined;
  const lit = document.createElementNS(SVG, 'path');
  lit.setAttribute('fill', 'white');
  const outside = document.createElementNS(SVG, 'path');
  outside.setAttribute('d', `${full} ${shape.getAttribute('d')}`);
  outside.setAttribute('fill', 'black');
  outside.setAttribute('fill-rule', 'evenodd');
  shape.replaceWith(lit, outside);

  // The spiral the pixels go out along, from the edges in, in square tiles.
  const tiles: string[] = [];
  const tileSize = TILE * pitch;
  let left = 0;
  let right = Math.ceil(columns / TILE) - 1;
  let top = 0;
  let bottom = Math.ceil(rows / TILE) - 1;
  const visit = (x: number, y: number) => {
    const w = Math.min(tileSize, width - x * tileSize);
    const h = Math.min(tileSize, height - y * tileSize);
    tiles.push(`M${x * tileSize} ${y * tileSize}h${w}v${h}h${-w}Z`);
  };
  while (left <= right && top <= bottom) {
    for (let x = left; x <= right; x++) visit(x, top);
    top++;
    for (let y = top; y <= bottom; y++) visit(right, y);
    right--;
    if (top <= bottom) {
      for (let x = right; x >= left; x--) visit(x, bottom);
      bottom--;
    }
    if (left <= right) {
      for (let y = bottom; y >= top; y--) visit(left, y);
      left++;
    }
  }

  return {
    pitch,
    columns,
    rows,
    full,
    span,
    /** Sets which pixels are lit. */
    light: pathSetter(lit),
    /**
     * Clips `element` to the sign less the cells it is given, as a path; `name` makes the clip's
     * ID unique within the sign. Returns the clip's setter, which starts with the whole sign.
     *
     * The element sits inside the mask, and Safari does not see a clip's path change there, so a
     * group hidden once, as the fields are between cycles, would stay hidden until something else
     * redrew the sign. So two clips take turns: each change goes into the one not in use, and the
     * element is pointed at it, a change Safari does see.
     */
    clip(element: SVGElement, name: string) {
      const clips = ['a', 'b'].map((turn) => {
        const clip = document.createElementNS(SVG, 'clipPath');
        clip.id = `${prefix}-${name}-${turn}`;
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        const path = document.createElementNS(SVG, 'path');
        path.setAttribute('clip-rule', 'evenodd');
        clip.append(path);
        defs.append(clip);
        return { id: clip.id, path };
      });
      let turn = 0;
      let shown: string | undefined;
      const set = (d: string) => {
        if (d === shown) return;
        shown = d;
        turn = 1 - turn;
        clips[turn].path.setAttribute('d', d);
        element.setAttribute('clip-path', `url(#${clips[turn].id})`);
      };
      set(full);
      return set;
    },
    /** The pixels lit at `progress` through the writing, which fills the sign row by row. */
    writing(progress: number) {
      if (progress <= 0) return '';
      if (progress >= 1) return full;
      const count = Math.floor((progress * columns * rows) / WRITE_STEP) * WRITE_STEP;
      const done = Math.floor(count / columns);
      return `M0 0H${width}V${at(done)}H0Z ${span(done, 0, count % columns)}`;
    },
    /** The pixels still lit at `progress` through the spiral. */
    spiral(progress: number) {
      return tiles.slice(Math.floor(Math.max(0, progress) * tiles.length)).join('');
    },
  };
}

export type Surface = NonNullable<ReturnType<typeof createSurface>>;
