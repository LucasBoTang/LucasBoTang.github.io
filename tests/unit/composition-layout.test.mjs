import assert from 'node:assert/strict';
import test from 'node:test';
import { compositionPaths } from '../../src/components/catalogue/L2oFigure/composition-layout.ts';

const boxes = {
  input: { x: 0, y: 0, w: 200, h: 50, cx: 100, cy: 25 },
  map: { x: 0, y: 100, w: 200, h: 100, cx: 100, cy: 150 },
  cor: { x: 220, y: 100, w: 180, h: 100, cx: 310, cy: 150 },
  op: { x: 400, y: 240, w: 200, h: 90, cx: 500, cy: 285 },
  loss: { x: 400, y: 340, w: 200, h: 70, cx: 500, cy: 375 },
  readings: { left: 10, right: 190, top: 20, bottom: 45, width: 180, height: 25 },
  network: { top: 130, height: 40 },
};

test('desktop connections leave the parameter fork, network ports and loss divider clear', () => {
  assert.deepEqual(compositionPaths({ ...boxes, mobile: false }), [
    { d: 'M100 57V93', stage: 'mapping' },
    { d: 'M202 32.5H310V93', stage: 'correction' },
    { d: 'M207 150H213', stage: 'correction' },
    { d: 'M407 150H393', stage: 'update' },
    { d: 'M500 327V336', stage: 'loss' },
  ]);
});

test('compact connections preserve their branch and short update markers', () => {
  assert.deepEqual(compositionPaths({ ...boxes, mobile: true }), [
    { d: 'M100 51V96', stage: 'mapping' },
    { d: 'M100 76H310V96', stage: 'correction' },
    { d: 'M203 150H217', stage: 'correction' },
    { d: 'M500 213V227', stage: 'update' },
    { d: 'M500 327V336', stage: 'loss' },
  ]);
});
