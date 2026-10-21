import assert from 'node:assert/strict';
import test from 'node:test';
import { planTyping } from '../../src/components/ui/TypedText/typing-rhythm.ts';

test('typing is repeatable, advances in time and reaches the complete passage', () => {
  const text = 'Reliable methods, reusable frameworks. Practical decisions.';
  const rhythm = { sentencePause: 180, commaPause: 60 };
  const strokes = planTyping(text, rhythm);
  assert.deepEqual(strokes, planTyping(text, rhythm));
  assert.deepEqual(planTyping('', rhythm), []);
  assert.equal(strokes.at(-1).count, text.length);
  for (let i = 1; i < strokes.length; i++) {
    assert.ok(strokes[i].at > strokes[i - 1].at);
    assert.ok(strokes[i].count > strokes[i - 1].count);
  }
});

test('a repeated word produces only one corrected slip and retains punctuation', () => {
  const text = 'Learning, then learning again.';
  const strokes = planTyping(text, { slipWord: 'learning', keyDelay: 10, slipPace: 0.45 });
  const deletions = strokes.filter((stroke, i) => i > 0 && stroke.count < strokes[i - 1].count);
  assert.equal(deletions.length, 2);
  const lastSwap = strokes.findLastIndex((stroke) => stroke.swapped !== undefined);
  assert.ok(lastSwap > 0);
  assert.equal(strokes[lastSwap + 3].count, 'Learning'.length);
  assert.equal(strokes[lastSwap + 4].count, 'Learning,'.length);
  assert.equal(strokes.at(-1).count, text.length);
  assert.equal(strokes.at(-1).swapped, undefined);
});

test('a phrase breath preserves every keystroke and introduces no wait after the final period', () => {
  const text = 'Frameworks for decision-making.';
  const ordinary = planTyping(text, { keyDelay: 10 });
  const settled = planTyping(text, { keyDelay: 10, thinkBefore: { decisionmaking: 60 } });
  const prefix = 'Frameworks for '.length;
  assert.deepEqual(settled.slice(0, prefix), ordinary.slice(0, prefix));
  assert.equal(settled.length, ordinary.length);
  for (let i = prefix; i < ordinary.length; i++) {
    assert.equal(settled[i].count, ordinary[i].count);
    assert.ok(Math.abs(settled[i].at - ordinary[i].at - 60) < 0.001);
  }
  assert.equal(settled.at(-1).count, text.length);
  const finalStep = settled.at(-1).at - settled.at(-2).at;
  assert.ok(finalStep < 20, 'the period closes the passage without a separate wait');
});
