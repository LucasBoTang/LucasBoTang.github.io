import { openingTiming as time } from '../opening/opening';

// The glitch from the portrait's pixel picture to the photograph, as a fixed score. The two
// struggle: the photograph flickers through, takes over, is cut by the picture again, and wins.
// Each frame is a stack of horizontal bands from either source. Wherever the photograph shows, it
// is cut into blocks through the hair, eyes, hand and arm, and each block slips sideways in the
// measure of the blue third's shift, as the blue third will. The blocks slip both ways but lean
// right, and a slip often holds while the sources swap under it, as a signal out of step would.
// The lower third alone holds still until the name begins to decode, slips a little, and only at
// the end all the way: right, past its place and back, staying in the blue ink. So the shift
// reads as the last of these slips. The photograph shows only where the picture has come up, so
// a part still forming stays missing in both.

/** The photograph, the pixel picture, or the photograph in the blue ink. */
type Source = 'photo' | 'picture' | 'ink';
/** A band's top and bottom as shares of the frame's height, its source, and its slip: in CSS px,
 * or as a share of the blue third's shift (`{ shift }`). */
type Band = [top: number, bottom: number, source: Source, slip: number | { shift: number }];
type Score = { until: number; bands: Band[] }[];

/** The blue third begins two thirds of the way down. */
const LOWER = 0.667;
/** A whole frame of either source. */
const ALL_PICTURE: Band[] = [[0, 1, 'picture', 0]];
const ALL_PHOTO: Band[] = [[0, 1, 'photo', 0]];

/** Slivers fall on the eyes (about 0.3) and the mouth (about 0.44). */
const SCORE: Score = [
  // A hint: the photograph flickers through at the eyes, torn in two; the picture holds.
  {
    until: 0.08,
    bands: [
      [0, 0.27, 'picture', 0],
      [0.27, 0.3, 'photo', 10],
      [0.3, 0.305, 'picture', -14],
      [0.305, 0.335, 'photo', -6],
      [0.335, 1, 'picture', 0],
    ],
  },
  { until: 0.15, bands: ALL_PICTURE },
  // The photograph breaks through already cut: blocks slip at the hair, the hand, the arm and below.
  {
    until: 0.25,
    bands: [
      [0, 0.12, 'photo', 0],
      [0.12, 0.22, 'photo', { shift: 0.8 }],
      [0.22, 0.36, 'photo', 0],
      [0.36, 0.41, 'photo', { shift: -1 }],
      [0.41, 0.58, 'photo', 0],
      [0.58, LOWER, 'photo', { shift: 0.6 }],
      [LOWER, 1, 'photo', 0],
    ],
  },
  // The picture returns, and holds the same slips.
  {
    until: 0.31,
    bands: [
      [0, 0.12, 'picture', 0],
      [0.12, 0.22, 'picture', { shift: 0.8 }],
      [0.22, LOWER, 'picture', 0],
      [LOWER, 1, 'picture', 0],
    ],
  },
  // A kick back: the blocks are cut elsewhere and thrown the other way.
  {
    until: 0.4,
    bands: [
      [0, 0.2, 'photo', { shift: -0.5 }],
      [0.2, 0.28, 'photo', 0],
      [0.28, 0.34, 'photo', { shift: 1.4 }],
      [0.34, 0.5, 'photo', { shift: 0.3 }],
      [0.5, 0.53, 'photo', { shift: -1.5 }],
      [0.53, LOWER, 'photo', 0],
      [LOWER, 1, 'photo', 0],
    ],
  },
  {
    until: 0.48,
    bands: [
      [0, 0.3, 'picture', 0],
      [0.3, 0.32, 'photo', 13],
      [0.32, 0.6, 'picture', 0],
      [0.6, LOWER, 'picture', { shift: 1 }],
      [LOWER, 1, 'picture', 0],
    ],
  },
  // Further right than before, from the crown to the arm.
  {
    until: 0.58,
    bands: [
      [0, 0.08, 'photo', { shift: 0.6 }],
      [0.08, 0.25, 'photo', 0],
      [0.25, 0.33, 'photo', { shift: -0.8 }],
      [0.33, 0.45, 'photo', { shift: 1.1 }],
      [0.45, LOWER, 'photo', 0],
      [LOWER, 1, 'photo', 0],
    ],
  },
  // A breath on the whole photograph, as the name begins to decode.
  { until: 0.64, bands: ALL_PHOTO },
  // The picture cuts back across the eyes, and the blocks are thrown once more.
  {
    until: 0.71,
    bands: [
      [0, 0.27, 'photo', { shift: 0.5 }],
      [0.27, 0.31, 'picture', -12],
      [0.31, 0.315, 'photo', 18],
      [0.315, 0.5, 'photo', { shift: -0.6 }],
      [0.5, LOWER, 'photo', { shift: 0.3 }],
      [LOWER, 1, 'picture', { shift: -0.2 }],
    ],
  },
  {
    until: 0.78,
    bands: [
      [0, 0.18, 'photo', 0],
      [0.18, 0.3, 'photo', { shift: -0.5 }],
      [0.3, LOWER, 'photo', 0],
      [LOWER, 1, 'photo', { shift: 0.4 }],
    ],
  },
  // The resolve: a last flash of the picture, then the lower third slips past its place and back.
  {
    until: 0.84,
    bands: [
      [0, LOWER, 'picture', 0],
      [LOWER, 1, 'picture', { shift: 1 }],
    ],
  },
  {
    until: 0.9,
    bands: [
      [0, 0.55, 'photo', 0],
      [0.55, 0.6, 'photo', 10],
      [0.6, 0.605, 'photo', -16],
      [0.605, LOWER, 'photo', -6],
      [LOWER, 0.75, 'ink', { shift: 1.4 }],
      [0.75, 0.755, 'ink', { shift: 0.2 }],
      [0.755, 1, 'ink', { shift: 1.4 }],
    ],
  },
  {
    until: 0.95,
    bands: [
      [0, LOWER, 'photo', 0],
      [LOWER, 1, 'ink', { shift: 1.15 }],
    ],
  },
  {
    until: 1,
    bands: [
      [0, LOWER, 'photo', 0],
      [LOWER, 1, 'ink', { shift: 1 }],
    ],
  },
];

/** The two sources a glitch frame draws from, and where the frame sits on the canvas. */
export interface GlitchSources {
  /** The pixel picture as it stands, the size of the whole canvas. */
  picture: HTMLCanvasElement;
  /** The photograph where the picture has formed, the size of the frame. */
  photo: HTMLCanvasElement;
  /** The same in the blue ink. */
  ink: HTMLCanvasElement;
  originX: number;
  originY: number;
  frameWidth: number;
  frameHeight: number;
}

/**
 * The score in opening time and device pixels, for a frame `frameHeight` tall at `ratio`, whose
 * blue third shifts `inkShift` CSS px.
 */
export function glitchFrames(frameHeight: number, ratio: number, inkShift: number) {
  const span = time.glitchEnd - time.glitchStart;
  return SCORE.map(({ until, bands }) => ({
    until: time.glitchStart + until * span,
    bands: bands.map(([top, bottom, source, slip]) => ({
      y: Math.round(top * frameHeight),
      height: Math.round(bottom * frameHeight) - Math.round(top * frameHeight),
      source,
      slip: Math.round((typeof slip === 'number' ? slip : slip.shift * inkShift) * ratio),
    })),
  }));
}
type GlitchFrame = ReturnType<typeof glitchFrames>[number];

/** Draws `frame` onto a cleared `context`. */
export function drawGlitchFrame(
  context: CanvasRenderingContext2D,
  frame: GlitchFrame,
  { picture, photo, ink, originX, originY, frameWidth }: GlitchSources,
) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  for (const { y, height, source, slip } of frame.bands) {
    if (height <= 0) continue;
    const [image, sx, sy] =
      source === 'picture'
        ? [picture, originX, originY + y]
        : [source === 'ink' ? ink : photo, 0, y];
    context.drawImage(
      image,
      sx,
      sy,
      frameWidth,
      height,
      originX + slip,
      originY + y,
      frameWidth,
      height,
    );
  }
}
