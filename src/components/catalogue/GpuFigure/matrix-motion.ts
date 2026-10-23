import { smoothstep as smooth } from '../../../lib/easing.ts';

const PHRASE_DURATION_MS = 2700;
const CYCLE_DURATION_MS = 2 * PHRASE_DURATION_MS;
// Ease the complete breath together, retaining the relative scan and light choreography.
export const matrixPlaybackRate = 0.85;
// Envelope and hardware timings are in seconds within each phrase.
// The result's rise meets its release: one breath, without a display plateau.
const ENVELOPE = { fadeDuration: 0.5, fadeOutStart: 2, arrowsStart: 0.4 };
const SCAN = {
  start: 0.65,
  duration: 0.8,
  resultStart: 1.5,
  arrowFadeDuration: 0.3,
};
const LIGHTS = {
  start: 0.4,
  riseDuration: 0.65,
  fadeOutStart: 1.7,
  fadeOutDuration: 0.7,
  indicatorOpacity: 0.85,
  chipOpacity: 0.9,
};
const BUS_PULSE = {
  start: 0.65,
  duration: 1.35,
  fadeInFraction: 0.18,
  fadeOutStart: 0.78,
  fadeOutFraction: 0.22,
  opacity: 0.85,
  initialOffset: 18,
  travelDistance: 136,
};

/** Sample both multiplication directions and their hardware response on the supplied clock. */
export function matrixMotionAt(elapsedMs: number, reducedMotion: boolean) {
  const phase = Math.floor((elapsedMs % CYCLE_DURATION_MS) / PHRASE_DURATION_MS);
  const phraseSeconds = (elapsedMs % PHRASE_DURATION_MS) / 1000;
  // A brief clear interval separates the two multiplication directions.
  const envelope = (start: number) =>
    smooth((phraseSeconds - start) / ENVELOPE.fadeDuration) *
    (1 - smooth((phraseSeconds - ENVELOPE.fadeOutStart) / ENVELOPE.fadeDuration));
  // Finish sweeping the density mask before revealing the products.
  const scanProgress = smooth((phraseSeconds - SCAN.start) / SCAN.duration);
  const scanning =
    !reducedMotion && phraseSeconds >= SCAN.start && phraseSeconds < SCAN.start + SCAN.duration;
  const scanAlpha =
    smooth((phraseSeconds - SCAN.start) / 0.18) *
    (1 - smooth((phraseSeconds - (SCAN.start + SCAN.duration - 0.18)) / 0.18));
  const outputArrowOpacity = reducedMotion
    ? 0
    : smooth((phraseSeconds - SCAN.resultStart) / SCAN.arrowFadeDuration) *
      (1 - smooth((phraseSeconds - ENVELOPE.fadeOutStart) / ENVELOPE.fadeDuration));
  // Reveal shaft then tip along the path; one restrained directional gesture.
  const flowMotion = (output: boolean) => {
    const age = phraseSeconds - (output ? SCAN.resultStart : ENVELOPE.arrowsStart);
    const reveal = reducedMotion ? 0 : smooth(age / 0.38);
    const nudge =
      age > 0.38 && age < 0.94 ? 1.5 * Math.sin((Math.PI * (age - 0.38)) / 0.56) ** 2 : 0;
    return { reveal, shift: Math.round(nudge * 1000) / 1000 };
  };
  const breath = reducedMotion
    ? 0
    : smooth((phraseSeconds - LIGHTS.start) / LIGHTS.riseDuration) *
      (1 - smooth((phraseSeconds - LIGHTS.fadeOutStart) / LIGHTS.fadeOutDuration));
  const travel = Math.max(0, Math.min(1, (phraseSeconds - BUS_PULSE.start) / BUS_PULSE.duration));
  const busOpacity = reducedMotion
    ? 0
    : smooth(travel / BUS_PULSE.fadeInFraction) *
      (1 - smooth((travel - BUS_PULSE.fadeOutStart) / BUS_PULSE.fadeOutFraction));
  const arrows = envelope(ENVELOPE.arrowsStart);
  return {
    phase,
    inputOpacity: envelope(0),
    resultOpacity: envelope(SCAN.resultStart),
    scanProgress,
    downScanOpacity: scanning && phase === 0 ? scanAlpha : 0,
    rightScanOpacity: scanning && phase === 1 ? scanAlpha : 0,
    outputArrowOpacity,
    inputFlow: flowMotion(false),
    outputFlow: flowMotion(true),
    indicatorOpacity: LIGHTS.indicatorOpacity * breath,
    chipOpacity: LIGHTS.chipOpacity * breath,
    busOpacity: BUS_PULSE.opacity * busOpacity,
    busOffset: BUS_PULSE.initialOffset - BUS_PULSE.travelDistance * travel,
    productOpacity: reducedMotion || phase === 1 ? 0 : arrows,
    transposeProductOpacity: reducedMotion || phase === 0 ? 0 : arrows,
  };
}
