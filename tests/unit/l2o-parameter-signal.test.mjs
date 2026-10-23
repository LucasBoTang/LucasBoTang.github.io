import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import {
  createParameterSignals,
  sampleParameterSignal,
} from '../../src/components/catalogue/L2oFigure/parameter-signal.ts';

test('parameter symbols and numeric readouts move independently with occasional tears', () => {
  const samples = Array.from({ length: 200 }, (_, i) =>
    ['a', 'b', 'a-value', 'b-value'].map((name) => sampleParameterSignal(i * 0.1, name)),
  );
  for (const frames of samples)
    for (const frame of frames) {
      assert.ok(Math.abs(frame.x) <= 0.7);
      assert.ok(Math.abs(frame.y) <= 0.5);
      assert.ok(frame.opacity >= 0.9 && frame.opacity <= 1);
      assert.ok(frame.tearOpacity === 0 || frame.tearOpacity <= 0.5);
    }
  assert.ok(new Set(samples.map(([a]) => `${a.x},${a.y}`)).size > 100);
  assert.ok(samples.filter(([a, b]) => a.x !== b.x || a.y !== b.y).length > 180);
  assert.ok(samples.filter(([a, , value]) => a.x !== value.x || a.y !== value.y).length > 180);
  assert.ok(samples.filter(([, b, , value]) => b.x !== value.x || b.y !== value.y).length > 180);
  const tears = samples.filter(([a]) => a.tearOpacity > 0).length;
  assert.ok(
    tears > 5 && tears < 40,
    'tearing stays occasional while the underlying letter keeps moving',
  );
});

test('symbol and numeric signals preserve the recorded values', () => {
  const { document } = parseHTML(
    '<div id="root"><span>a</span><b>3.898</b><span>b</span><b>5.811</b></div>',
  );
  const root = document.getElementById('root');
  const update = createParameterSignals(root);
  const content = root.innerHTML;
  update(0.25);
  assert.equal(
    root.style.getPropertyValue('--input-a-x'),
    `${sampleParameterSignal(0.25, 'a').x}px`,
  );
  assert.equal(
    root.style.getPropertyValue('--input-b-y'),
    `${sampleParameterSignal(0.25, 'b').y}px`,
  );
  assert.equal(
    root.style.getPropertyValue('--input-a-value-x'),
    `${sampleParameterSignal(0.25, 'a-value').x}px`,
  );
  assert.equal(
    root.style.getPropertyValue('--input-b-value-y'),
    `${sampleParameterSignal(0.25, 'b-value').y}px`,
  );
  assert.equal(root.innerHTML, content);
  update(1.2);
  assert.equal(
    root.style.getPropertyValue('--input-a-x'),
    `${sampleParameterSignal(1.2, 'a').x}px`,
  );
  assert.equal(root.innerHTML, content);
});

test('reduced motion restores both symbols and their echoes to a steady state', () => {
  const { document } = parseHTML('<div id="root"></div>');
  const root = document.getElementById('root');
  const update = createParameterSignals(root);
  update(1.2);
  update(1.2, true);
  for (const parameter of ['a', 'b', 'a-value', 'b-value']) {
    assert.equal(root.style.getPropertyValue(`--input-${parameter}-x`), '0px');
    assert.equal(root.style.getPropertyValue(`--input-${parameter}-y`), '0px');
    assert.equal(root.style.getPropertyValue(`--input-${parameter}-opacity`), '1');
    assert.equal(root.style.getPropertyValue(`--input-${parameter}-echo`), '0');
    if (parameter.endsWith('-value')) {
      assert.equal(root.style.getPropertyValue(`--input-${parameter}-trail-opacity`), '0');
      assert.equal(root.style.getPropertyValue(`--input-${parameter}-trail-x`), '0px');
      assert.equal(root.style.getPropertyValue(`--input-${parameter}-trail-y`), '0px');
    }
  }
});

test('numeric afterimages cluster around faults and clear while the quiet signal keeps moving', () => {
  for (const channel of ['a-value', 'b-value']) {
    const frames = Array.from({ length: 1200 }, (_, i) => sampleParameterSignal(i / 120, channel));
    const clear = frames.filter((frame) => frame.trailOpacity === 0);
    assert.ok(clear.length > frames.length * 0.75, 'the number must read clean between faults');
    assert.ok(clear.length < frames.length * 0.97, 'short afterimages still punctuate the signal');
    assert.ok(new Set(clear.map((frame) => `${frame.x},${frame.y}`)).size > 40);
    const starts = frames.flatMap((frame, i) =>
      frame.trailOpacity > 0 && (!i || frames[i - 1].trailOpacity === 0) ? [i / 120] : [],
    );
    const intervals = starts.slice(1).map((time, i) => time - starts[i]);
    assert.ok(intervals.length >= 4);
    assert.ok(Math.max(...intervals) - Math.min(...intervals) > 0.15, 'faults cannot form a beat');
    assert.ok(frames.every((frame) => frame.trailOpacity <= 0.28));
  }
});
