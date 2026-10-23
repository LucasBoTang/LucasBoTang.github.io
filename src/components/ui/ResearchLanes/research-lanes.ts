import { ARRIVAL_EVENT, ARRIVAL_PREPARE_EVENT } from '../../../lib/arrival';
import { isPhone, phonePace } from '../../../lib/breakpoints';
import { enhance } from '../../../lib/lifecycle';
import { watchActivity } from '../../../lib/motion';
import { prepareLaneArrival } from './lane-arrival';

// Home already owns its lanes' activity and opening through the hero controller.
enhance<HTMLElement>('[data-research-lanes]', (lanes) => {
  const unit = lanes.closest<HTMLElement>('[data-reveal="lead"]');
  let entrance: ReturnType<typeof prepareLaneArrival> | undefined;
  unit?.addEventListener(ARRIVAL_PREPARE_EVENT, (event) => {
    if (!isPhone()) return;
    const group = (event as CustomEvent<Animation[]>).detail;
    entrance = prepareLaneArrival(lanes, phonePace());
    group.forEach((animation) => animation.cancel());
    group.splice(0, group.length, ...entrance.animations);
  });
  unit?.addEventListener(ARRIVAL_EVENT, (event) => {
    entrance?.startDrift((event as CustomEvent<{ delay: number }>).detail.delay);
  });
  watchActivity(lanes, ({ inView, hidden, reduced }) => {
    lanes.toggleAttribute('data-motion-ready', !reduced);
    lanes.toggleAttribute('data-motion-suspended', hidden || inView.size === 0);
  });
});
