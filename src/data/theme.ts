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

// The approved GPU artwork palette; emitted only by its figure document.
const gpuPalette = {
  'gpu-primal': '#91afd2',
  'gpu-dual': '#97b5a8',
  'gpu-gap': '#d6d6d0',
  'gpu-text': '#c3cedd',
  'gpu-rule': '#30373e',
  'gpu-idle': '#3b4a5a',
  'gpu-hardware': '#5f7287',
  'gpu-unit': '#7b8897',
  'gpu-label': '#87929e',
  'gpu-channel-label': '#9ba5af',
  'gpu-active': '#c0d3eb',
  'gpu-metric': '#d0ddec',
  'gpu-instance': '#8b949f',
  'gpu-dimension-label': '#8d97a3',
  'gpu-title': '#9db3cf',
  'gpu-caption': '#9eb2cc',
  'gpu-dimension': '#aec0d7',
} as const;

// This figure-only initializer is removed from the main-page client bundle.
export const gpuTheme = /* @__PURE__ */ (() =>
  ({
    ...gpuPalette,
    'gpu-digit-glow': withAlpha(gpuPalette['gpu-metric'], 13),
    'gpu-indicator-glow': withAlpha(gpuPalette['gpu-primal'], 40),
    'gpu-ink-clear': withAlpha(palette.ink, 0),
    'gpu-ink-soft': withAlpha(palette.ink, 16),
    'gpu-ink-shade': withAlpha(palette.ink, 38),
  }) as const)();
