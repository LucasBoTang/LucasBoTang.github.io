import { hash, type Surface } from './sign-surface';

// The switch from the fields to the slogan. The fields scramble away, cell by cell, into solid
// pixels: each cell goes at its own moment, without a direction, but can come back briefly before
// it does, and some pixels go dark meanwhile. Overlapping it, a front writes the slogan in from left
// to right, its letters flickering just behind the front before they settle.

/** The scramble, over `duration` milliseconds: cells change every `tick`; at its height, up to
 * `unsettled` of them have come back for a moment and `dark` of the pixels are out. */
const scramble = { duration: 520, tick: 70, unsettled: 0.25, dark: 0.16 };
/** The front, from `from` milliseconds into the switch, over `duration`: letters flicker within
 * `width` columns behind it, changing every `tick`; each row lags it by up to `ragged` columns,
 * so its edge is uneven. */
const flicker = { from: 100, duration: 500, width: 8, tick: 50, ragged: 3 };

/** The switch on `surface`. */
export function createSwitch(surface: Surface) {
  const { columns, rows, span } = surface;
  const lags = Array.from({ length: rows }, (_, row) =>
    Math.floor(hash(row * 31 + 5) * (flicker.ragged + 1)),
  );

  return {
    /** The switch lasts until both the scramble and the front are done. */
    duration: Math.max(scramble.duration, flicker.from + flicker.duration),
    /** The cells that show the slogan, those that show the fields, and those that are lit,
     * `elapsed` milliseconds into the switch. */
    at(elapsed: number) {
      const clearing = Math.min(1, elapsed / scramble.duration);
      const written = Math.min(1, Math.max(0, (elapsed - flicker.from) / flicker.duration));
      const scrambleTick = Math.floor(elapsed / scramble.tick);
      const flickerTick = Math.floor(elapsed / flicker.tick);
      const unsettled = scramble.unsettled * Math.sin(Math.PI * clearing);
      const dark = scramble.dark * Math.sin(Math.PI * clearing);
      const front = -flicker.width + written * (columns + flicker.width + flicker.ragged);
      // Each layer's cells are gathered into runs along the row, so a path holds one shape per run.
      const paths = { slogan: '', fields: '', lit: '' };
      for (let row = 0; row < rows; row++) {
        const runs = { slogan: -1, fields: -1, lit: -1 };
        const mark = (layer: keyof typeof paths, on: boolean, column: number) => {
          if (on && runs[layer] < 0) runs[layer] = column;
          else if (!on && runs[layer] >= 0) {
            paths[layer] += span(row, runs[layer], column);
            runs[layer] = -1;
          }
        };
        for (let column = 0; column <= columns; column++) {
          const inside = column < columns;
          const key = row * columns + column;
          const gone = hash(key + 13) < clearing;
          const behind = front - lags[row] - column;
          mark('fields', inside && gone === hash(key * 3 + scrambleTick * 719) < unsettled, column);
          mark(
            'slogan',
            inside &&
              (behind >= flicker.width ||
                (behind > 0 && hash(key * 5 + flickerTick * 977) < behind / flicker.width)),
            column,
          );
          mark('lit', inside && hash(key * 7 + scrambleTick * 541) > dark, column);
        }
      }
      return paths;
    },
  };
}
