import { hexChannels, theme } from '../src/data/theme';

const rgb = (hex: string) => `rgb(${hexChannels(hex).join(', ')})`;

/** Browser serialization of the palette roles used in layout assertions. */
export const cssColors = {
  ink: rgb(theme.ink),
  paper: rgb(theme.paper),
  blue: rgb(theme.blue),
  muted: rgb(theme.muted),
  'signal-light': rgb(theme['signal-light']),
};
