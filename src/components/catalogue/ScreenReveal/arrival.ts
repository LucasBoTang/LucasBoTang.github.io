import distortion from './screen-filters.svg?url&no-inline';

// Acquire the whole picture without changing its proportions. A single 90ms horizontal
// disturbance resolves during the rise; the clear picture rests before its clock starts.
const DURATION = 640;

export function screenArrival(element: Element): Animation[] | null {
  const screen = element.querySelector('.screen-reveal');
  const picture = screen?.querySelector('.screen-picture');
  if (!screen || !picture) return null;
  const timing: KeyframeAnimationOptions = { duration: DURATION, easing: 'linear', fill: 'both' };
  const at = (time: number) => time / DURATION;
  const opening = picture.animate(
    [
      { offset: 0, opacity: 0 },
      { offset: at(45), opacity: 0.36 },
      { offset: at(120), opacity: 0.62 },
      { offset: at(220), opacity: 0.82, easing: 'cubic-bezier(.22,1,.36,1)' },
      { offset: at(430), opacity: 1 },
      { offset: 1, opacity: 1 },
    ],
    timing,
  );
  screen.setAttribute('data-screen-pending', '');
  // The shared queue owns cancellation as well as completion; both must release child clocks.
  opening.addEventListener('cancel', () => screen.removeAttribute('data-screen-pending'), {
    once: true,
  });
  return [
    opening,
    picture.animate(
      [
        { offset: 0, filter: 'none' },
        { offset: at(110), filter: `url("${distortion}#screen-pull")` },
        { offset: at(160), filter: `url("${distortion}#screen-catch")` },
        { offset: at(200), filter: 'none' },
        { offset: 1, filter: 'none' },
      ].map((frame) => ({ ...frame, easing: 'steps(1, end)' })),
      timing,
    ),
    ...Array.from(element.querySelectorAll(':scope > figcaption, :scope > details'), (copy) =>
      copy.animate(
        [
          { offset: 0, opacity: 0 },
          { offset: at(320), opacity: 0, easing: 'cubic-bezier(.33,1,.68,1)' },
          { offset: at(580), opacity: 1 },
          { offset: 1, opacity: 1 },
        ],
        timing,
      ),
    ),
  ];
}
