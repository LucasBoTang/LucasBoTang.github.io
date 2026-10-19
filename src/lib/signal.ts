// The timing of the signal glitch, which src/styles/signal.css sets as `--signal-burst`.

/** At rest, a name glitches this often, in milliseconds: the home name with the portrait's bursts,
 * and page titles on their own, in the same rhythm. */
export const SIGNAL_INTERVAL = 8000;

/** An element stays marked `data-slip` this much longer than its burst plays, about a frame, so
 * the burst always completes. */
const GRACE = 20;

/** How long one burst plays, in milliseconds, whether the token is written in ms or s; 0 if the
 * token is missing, so no element is ever left marked. */
export const burstDuration = () => {
  const token = getComputedStyle(document.documentElement)
    .getPropertyValue('--signal-burst')
    .trim();
  const value = parseFloat(token);
  if (!Number.isFinite(value)) return 0;
  return token.endsWith('ms') ? value : token.endsWith('s') ? value * 1000 : value;
};

/** How long to keep an element marked `data-slip` for one burst, in milliseconds. */
export const slipDuration = () => burstDuration() + GRACE;
