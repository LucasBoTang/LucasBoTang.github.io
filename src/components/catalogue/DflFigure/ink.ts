// Read the document's theme once. Canvas shares the CSS palette without pulling
// the site's entire color generator into a new shared client bundle.
const styles = getComputedStyle(document.documentElement);
export const paper = styles.getPropertyValue('--paper').trim();
const signal = styles.getPropertyValue('--signal-light').trim();
const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const paperRGB = channels(paper).join(',');
export const signalRGB = channels(signal).join(',');
