import { installGlobals } from '../helpers/browser.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createConvergenceModel } from '../../src/components/catalogue/GpuFigure/convergence-model.ts';
import { createInstrumentView } from '../../src/components/catalogue/GpuFigure/instrument-view.ts';
import recording from '../../src/data/research/rail4284-convergence.json' with { type: 'json' };

function fixture(t) {
  const { document } = parseHTML(`<html><body><section><svg data-scope></svg>
    <output data-iteration>—</output><output data-time>—</output><output data-restarts>—</output>
    <output data-reading="primal">—</output><output data-reading="dual">—</output><output data-reading="gap">—</output>
  </section></body></html>`);
  const root = document.querySelector('section');
  const svg = root.querySelector('svg');
  Object.defineProperties(svg, { clientWidth: { value: 398 }, clientHeight: { value: 162 } });
  const animations = [];
  const owned = new WeakMap();
  let animationQueries = 0;
  const createElement = document.createElement.bind(document);
  document.createElement = (...args) => {
    const element = createElement(...args);
    element.animate = (keyframes, options) => {
      const animation = {
        keyframes,
        options,
        canceled: false,
        cancel() {
          this.canceled = true;
        },
      };
      animations.push(animation);
      owned.set(element, [...(owned.get(element) ?? []), animation]);
      return animation;
    };
    return element;
  };
  const activeAnimations = (output) =>
    [...output.querySelectorAll('*')]
      .flatMap((element) => owned.get(element) ?? [])
      .filter((animation) => !animation.canceled);
  for (const output of root.querySelectorAll('output')) {
    output.getAnimations = (options) => {
      assert.deepEqual(options, { subtree: true });
      animationQueries++;
      return activeAnimations(output);
    };
  }
  installGlobals(t, {
    document,
    getComputedStyle: () => ({ getPropertyValue: () => '#edf4f7' }),
  });
  const model = createConvergenceModel(recording);
  const view = createInstrumentView(root, model);
  return {
    root,
    model,
    view,
    animations,
    activeAnimations: () => activeAnimations(root),
    queries: () => animationQueries,
  };
}

test('reducing motion settles active final digits even when the recorded values did not change', (t) => {
  const f = fixture(t);
  const finalFrame = f.model.sample(18500, false);
  f.view.render(f.model.sample(0, false), false);
  f.view.render(f.model.sample(9500, false), false);
  f.view.render(finalFrame, false);
  const finalDigits = f.root.querySelector('[data-iteration]').innerHTML;
  const animationCount = f.animations.length;
  const activeFinalAnimations = f.activeAnimations();
  assert.ok(activeFinalAnimations.length > 0);
  assert.equal(f.queries(), 0, 'normal playback must not query animations per frame');
  f.view.render(finalFrame, true);
  assert.ok(
    activeFinalAnimations.every((animation) => animation.canceled),
    'reduced motion must cancel the still-running final digit transitions',
  );
  assert.equal(f.animations.length, animationCount);
  assert.equal(
    f.root.querySelector('[data-iteration]').innerHTML,
    finalDigits,
    'settling preserves the final digits',
  );
  const queriesAfterChange = f.queries();
  assert.ok(queriesAfterChange > 0);
  f.view.render(finalFrame, true);
  assert.equal(
    f.queries(),
    queriesAfterChange,
    'repeated reduced-motion frames must not repeat animation queries',
  );

  f.view.render(f.model.sample(9500, false), false);
  assert.ok(
    f.animations.length > animationCount,
    'new readings animate again after the preference is disabled',
  );
  assert.ok(f.animations.slice(animationCount).every((animation) => !animation.canceled));
  assert.equal(f.queries(), queriesAfterChange);
});

test('the plot and all readings fade and reset together for the next KKT pass', (t) => {
  const f = fixture(t);
  f.view.render(f.model.sample(18500, false), false, 1);
  assert.equal(f.root.querySelector('[data-iteration]').dataset.value, '17,800');
  f.view.render(f.model.sample(20700, false), false, 0.5);
  for (const element of f.root.querySelectorAll('svg, output')) {
    assert.equal(element.style.opacity, '0.5');
  }
  f.view.render(f.model.sample(0, false), false, 0);
  assert.equal(f.root.querySelector('[data-iteration]').dataset.value, '—');
  assert.equal(f.root.querySelector('[data-restarts]').dataset.value, '00');
  assert.equal(f.root.dataset.restarting, 'false');
  for (const element of f.root.querySelectorAll('svg, output')) {
    assert.equal(element.style.opacity, '0');
  }
  f.view.render(f.model.sample(9500, false), false, 1);
  assert.equal(f.root.querySelector('[data-iteration]').dataset.value, '8,800');
  for (const element of f.root.querySelectorAll('svg, output')) {
    assert.equal(element.style.opacity, '1');
  }
});
