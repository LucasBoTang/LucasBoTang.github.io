import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import {
  createReadoutWriter,
  createTrainingReadings,
} from '../../src/components/catalogue/L2oFigure/readouts.ts';
import { installGlobals } from '../helpers/browser.mjs';

const recording = JSON.parse(
  readFileSync(
    new URL('../../src/data/research/l2o-training-snapshots.json', import.meta.url),
    'utf8',
  ),
);

test('recorded dashboard readings retain their precision, mathematical signs and feasible gap', () => {
  const original = JSON.stringify(recording);
  const readings = createTrainingReadings(recording);
  assert.deepEqual(readings[0], {
    relaxed: { 'relaxed-x': '0.207', 'relaxed-y': '−0.114' },
    hidden: { 'delta-x': '−0.141', 'hidden-y': '−0.197' },
    integer: { 'integer-x': '0.067', 'integer-y': '−1' },
    loss: { objective: '65.13', violation: '3.91', gap: '—' },
  });
  assert.deepEqual(
    readings.map(({ loss }) => loss),
    [
      { objective: '65.13', violation: '3.91', gap: '—' },
      { objective: '42.56', violation: '1.91', gap: '—' },
      { objective: '39.88', violation: '0.00', gap: '8.23' },
      { objective: '36.31', violation: '0.00', gap: '4.66' },
    ],
  );
  assert.deepEqual(readings[3].hidden, { 'delta-x': '−0.684', 'hidden-y': '8.600' });
  assert.equal(JSON.stringify(recording), original, 'formatting must not alter the recording');
});

function fixture(t) {
  const { document } = parseHTML(
    '<html><body><b id="step">—</b><b id="state">—</b><b id="value">—</b></body></html>',
  );
  installGlobals(t, { document });
  const animations = [];
  const owned = new WeakMap();
  const createElement = document.createElement.bind(document);
  document.createElement = (...args) => prepare(createElement(...args));
  function prepare(element) {
    element.animate = (keyframes, options) => {
      const animation = {
        keyframes,
        options,
        canceled: false,
        onfinish: null,
        cancel() {
          this.canceled = true;
        },
      };
      animations.push(animation);
      owned.set(element, [...(owned.get(element) ?? []), animation]);
      return animation;
    };
    element.getAnimations = () =>
      [element, ...element.querySelectorAll('*')]
        .flatMap((node) => owned.get(node) ?? [])
        .filter((animation) => !animation.canceled);
    return element;
  }
  const step = prepare(document.querySelector('#step'));
  const state = prepare(document.querySelector('#state'));
  const value = prepare(document.querySelector('#value'));
  let reduced = false;
  const writer = createReadoutWriter(step, state, () => reduced);
  return {
    step,
    state,
    value,
    animations,
    write: writer.update,
    settle: () => writer.settle([step, state, value]),
    reduce: () => {
      reduced = true;
    },
  };
}

test('an unchanged status stays still while numeric checkpoints can explicitly refresh', (t) => {
  const f = fixture(t);
  f.write(f.state, 'Integer feasible');
  const status = f.state.firstChild;
  const firstCount = f.animations.length;
  f.write(f.state, 'Integer feasible');
  assert.equal(f.state.firstChild, status);
  assert.equal(f.animations.length, firstCount);
  f.write(f.value, '0.00');
  const strip = f.value.firstChild;
  f.write(f.value, '0.00');
  assert.equal(f.value.firstChild, strip);
  f.write(f.value, '0.00', true);
  assert.notEqual(
    f.value.firstChild,
    strip,
    'a completed stage refreshes unchanged numeric values',
  );
  assert.equal(f.value.getAttribute('aria-label'), '0.00');
});

test('Step keeps five right-aligned columns with no cascading digit delay', (t) => {
  const f = fixture(t);
  f.write(f.step, '9000', true);
  const cells = [...f.step.querySelectorAll('.readout-current')];
  assert.equal(cells.length, 5);
  assert.equal(cells.map((cell) => cell.textContent).join(''), '\u00a09000');
  assert.ok(f.animations.every((animation) => animation.options.delay === 0));
  assert.equal(f.step.getAttribute('aria-label'), '9000');
});

test('reduced motion cancels in-flight digits and leaves a complete readable value', (t) => {
  const f = fixture(t);
  f.write(f.value, '−1.910');
  const animated = f.animations.length;
  assert.ok(animated > 0);
  f.reduce();
  f.write(f.value, '−1.809');
  assert.equal(f.animations.length, animated);
  assert.ok(f.animations.every((animation) => animation.canceled));
  assert.equal(f.value.textContent, '−1.809');
  assert.equal(f.value.children.length, 0);
  assert.equal(f.value.getAttribute('aria-label'), '−1.809');
});

test('a reduced-motion switch settles unchanged final-checkpoint digits and status immediately', (t) => {
  const f = fixture(t);
  f.write(f.step, '9000', true);
  f.write(f.state, 'Integer feasible');
  f.write(f.value, '4.66');
  const animated = f.animations.length;
  f.reduce();
  // The same checkpoint does not trigger another update; the preference gate must settle it.
  f.write(f.step, '9000');
  f.write(f.state, 'Integer feasible');
  f.write(f.value, '4.66');
  f.settle();
  assert.equal(f.animations.length, animated);
  assert.ok(f.animations.every((animation) => animation.canceled));
  assert.deepEqual(
    [f.step.textContent, f.state.textContent, f.value.textContent],
    ['9000', 'Integer feasible', '4.66'],
  );
  assert.ok([f.step, f.state, f.value].every((slot) => slot.children.length === 0));
});

test('prediction fields reserve sign and decimal columns through animated and steady readings', (t) => {
  const f = fixture(t);
  const row = f.value.ownerDocument.createElement('div');
  row.className = 'prediction-readings';
  f.value.parentNode.append(row);
  row.append(f.value);
  for (const [value, aligned] of [
    ['−1.125', '−1.125'],
    ['2.889', '\u00a02.889'],
    ['4', '\u00a04\u00a0\u00a0\u00a0\u00a0'],
    ['−1', '−1\u00a0\u00a0\u00a0\u00a0'],
  ]) {
    f.write(f.value, value, true);
    assert.equal(
      [...f.value.querySelectorAll('.readout-current')].map((cell) => cell.textContent).join(''),
      aligned,
    );
    assert.equal(f.value.getAttribute('aria-label'), value);
    assert.equal(f.value.dataset.readingValue, value);
  }
  f.reduce();
  f.write(f.value, '2.889');
  assert.equal(f.value.textContent, '\u00a02.889');
  f.settle();
  assert.equal(f.value.textContent, '\u00a02.889');
  assert.equal(f.value.getAttribute('aria-label'), '2.889');
});
