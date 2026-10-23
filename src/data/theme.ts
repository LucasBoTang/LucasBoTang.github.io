// Single source for page colours, browser chrome and the generated favicon.
const palette = {
  ink: '#101113',
  paper: '#eeeef0',
  blue: '#6e8db8',
  muted: '#a3a7ad',
  'body-copy': '#c3c7ce',
  rule: '#2c3035',
  // Signal tint: the lighter channel in the name tear and the portrait's light pixels.
  'signal-light': '#8eafd9',
  // The pixels of the About sign.
  'sign-pixel': '#6183a9',
} as const;

/** The red, green and blue channels, 0 to 255, of a six-digit hex colour. */
export const hexChannels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** `rgb(r g b / n%)` for a six-digit hex colour. */
function withAlpha(hex: string, percent: number): string {
  const [r, g, b] = hexChannels(hex);
  return `rgb(${r} ${g} ${b} / ${percent}%)`;
}

/** The solid colour of `top` laid at `percent` opacity over `base`, as six-digit hex. */
function blend(base: string, top: string, percent: number): string {
  const under = hexChannels(base);
  const over = hexChannels(top);
  return `#${under
    .map((value, i) => Math.round(value + ((over[i] - value) * percent) / 100))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

export const theme = {
  ...palette,
  // The item rule, which parts the entries inside a section: the section rule at 60% on the
  // page, a step quieter than the full-width rule that opens each section.
  'rule-item': blend(palette.ink, palette.rule, 60),
  // The research lanes' unlit words: the blue at 22% on the page, made solid so it can cover
  // what lies beneath it.
  'blue-dim': blend(palette.ink, palette.blue, 22),
  // Glow behind a hovered research topic.
  'blue-glow': withAlpha(palette.blue, 90),
  'blue-glow-soft': withAlpha(palette.blue, 60),
} as const;

export const themeVariables = Object.entries(theme)
  .map(([name, value]) => `--${name}: ${value}`)
  .join('; ');
