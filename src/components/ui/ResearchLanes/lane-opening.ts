/** Shared field, ghost and light choreography; hosts choose when the sequence starts. */
export const laneTiming = { field: 1200, light: 1250, drift: 160, stagger: 140 };
const OPEN_EASING = 'cubic-bezier(.3,0,.2,1)';
interface LaneAnimation {
  element: Element | null;
  frames: Keyframe[];
  timing: { duration: number; delay?: number; easing: string };
}
export function laneAnimations(
  row: HTMLElement,
  field: number,
  light: number,
  delay: number,
): LaneAnimation[] {
  return [
    {
      element: row,
      frames: [{ opacity: 0 }, { opacity: 1, offset: 0.22 }, { opacity: 1 }],
      timing: { duration: field, easing: 'linear' },
    },
    {
      element: row.querySelector('[data-lane-field]'),
      frames: [{ '--lane-open': '0' }, { '--lane-open': '1' }],
      timing: { duration: field, easing: OPEN_EASING },
    },
    {
      element: row.querySelector('[data-lane-ghosts]'),
      frames: [{ opacity: 0 }, { opacity: 1 }],
      timing: { duration: field, easing: OPEN_EASING },
    },
    {
      element: row.querySelector('[data-lane-light]'),
      frames: [
        { '--lane-open': '0', opacity: 0 },
        { '--lane-open': '1', opacity: 1 },
      ],
      timing: { duration: light, delay, easing: OPEN_EASING },
    },
  ];
}
