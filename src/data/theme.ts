// Single source for page colours, browser chrome and the generated favicon.
export const theme = {
  ink: '#101113',
  paper: '#eeeef0',
  blue: '#6e8db8',
  muted: '#a3a7ad',
  'body-copy': '#c3c7ce',
  rule: '#2c3035',
} as const;

export const themeVariables = Object.entries(theme)
  .map(([name, value]) => `--${name}: ${value}`)
  .join('; ');
