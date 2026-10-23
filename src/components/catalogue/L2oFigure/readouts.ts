import { trainingCadence } from './timing.ts';

type TrainingRecording = {
  parameters: { a: number; b: number };
  relaxed: number[][];
  corrected: number[][];
  hidden: number[][];
  optimum: { objective: number };
};

/** Recorded values never change during playback; preserve their precision and mathematical sign. */
export function createTrainingReadings(recording: TrainingRecording) {
  const { a, b } = recording.parameters;
  const decimal = (value: number) => value.toFixed(3).replace('-', '−');
  return recording.corrected.map(([x, y], index) => {
    const residual = Math.max(0, b / 2 - y, x ** 2 - b, x, -y);
    const objective = (a - x) ** 2 + 50 * (y - x * x) ** 2;
    return {
      relaxed: {
        'relaxed-x': decimal(recording.relaxed[index][0]),
        'relaxed-y': decimal(recording.relaxed[index][1]),
      },
      hidden: {
        'delta-x': decimal(recording.hidden[index][0]),
        'hidden-y': decimal(recording.hidden[index][1]),
      },
      integer: { 'integer-x': decimal(x), 'integer-y': String(y).replace('-', '−') },
      loss: {
        objective: objective.toFixed(2),
        violation: residual.toFixed(2),
        gap: residual <= 1e-6 ? (objective - recording.optimum.objective).toFixed(2) : '—',
      },
    };
  });
}

/** Animate a changed reading, or refresh an unchanged value at its completed training stage. */
export function createReadoutWriter(
  stepSlot: HTMLElement,
  stateSlot: HTMLElement,
  isReduced: () => boolean,
) {
  const displayedValues = new WeakMap<HTMLElement, string>();
  function updateReading(slot: HTMLElement, value: string, refresh = false) {
    const previous = displayedValues.get(slot) ?? slot.textContent?.trim() ?? '—';
    if (previous === value && !refresh) return;
    displayedValues.set(slot, value);
    slot.dataset.readingValue = value;
    slot.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    slot.replaceChildren();
    slot.setAttribute('aria-label', value);
    if (isReduced()) {
      slot.textContent = value;
      return;
    }
    if (slot === stateSlot) {
      const old = document.createElement('span'),
        current = document.createElement('span');
      old.className = 'hud-status-old';
      current.className = 'hud-status-current';
      old.textContent = previous;
      current.textContent = value;
      old.setAttribute('aria-hidden', 'true');
      current.setAttribute('aria-hidden', 'true');
      slot.append(old, current);
      const exit = old.animate(
        [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(-2px)' },
        ],
        { duration: 120, easing: 'ease-out', fill: 'both' },
      );
      const enter = current.animate(
        [
          { opacity: 0, transform: 'translateY(2px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        {
          duration: trainingCadence.reading * 1000,
          easing: 'ease-out',
          fill: 'both',
        },
      );
      exit.onfinish = () => old.remove();
      enter.onfinish = () => enter.cancel();
      return;
    }
    // Preserve the Step counter's units column, including its waiting dash.
    const hudNumber = slot === stepSlot;
    const length = Math.max(hudNumber ? 5 : 0, previous.length, value.length);
    const oldValue = hudNumber ? previous.padStart(length) : previous.padEnd(length);
    const newValue = hudNumber ? value.padStart(length) : value.padEnd(length);
    const strip = document.createElement('span');
    strip.className = 'readout-strip';
    strip.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < length; i++) {
      const cell = document.createElement('span');
      cell.className = 'readout-cell';
      const old = document.createElement('span'),
        current = document.createElement('span');
      old.className = 'readout-old';
      old.textContent = oldValue[i] === ' ' ? '\u00a0' : oldValue[i];
      current.className = 'readout-current';
      current.textContent = newValue[i] === ' ' ? '\u00a0' : newValue[i];
      cell.append(old, current);
      strip.append(cell);
      const delay = hudNumber ? 0 : (i / Math.max(1, length - 1)) * trainingCadence.stagger * 1000,
        duration = trainingCadence.reading * 1000;
      old.animate(
        [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(-90%)' },
        ],
        { duration: 170, delay, fill: 'both', easing: 'ease-in' },
      );
      const enter = current.animate(
        hudNumber
          ? [
              { opacity: 0, transform: 'translateY(75%)' },
              { opacity: 1, transform: 'translateY(0)' },
            ]
          : [
              { opacity: 0, transform: 'translateY(100%)', textShadow: 'none' },
              { opacity: 0, offset: 0.16 },
              { opacity: 1, offset: 0.43, textShadow: '0 0 1px #e2edf3' },
              { opacity: 0.58, offset: 0.55 },
              { opacity: 1, transform: 'translateY(0)', textShadow: 'none' },
            ],
        { duration, delay, fill: 'both', easing: 'cubic-bezier(.2,.7,.25,1)' },
      );
      enter.onfinish = () => {
        old.remove();
        enter.cancel();
      };
    }
    slot.append(strip);
  }
  return {
    update: updateReading,
    /** Preference changes must also settle unchanged values whose animations are still running. */
    settle(slots: Iterable<HTMLElement>) {
      for (const slot of slots) {
        const value = displayedValues.get(slot) ?? slot.textContent?.trim() ?? '—';
        slot.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
        slot.textContent = value;
        slot.setAttribute('aria-label', value);
      }
    },
  };
}
