import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { observePreviewLayout } from '../../src/components/home/WorkPreview/preview-layout.ts';
import { installGlobals } from '../helpers/browser.mjs';

test('preview fitting keeps the three artworks equally wide within the existing row space', (t) => {
  const { document } = parseHTML(`<div id="previews">
    <a data-preview-width="716" data-preview-height="539" data-preview-bleed="64"><span></span></a>
    <a data-preview-width="652" data-preview-height="539" data-preview-bleed="32"><span></span></a>
    <a data-preview-width="588" data-preview-height="539" data-preview-bleed="0"><span></span></a>
  </div>`);
  const plates = [...document.querySelectorAll('a')];
  let width = 320;
  let pictureHeight = 160;
  for (const plate of plates) {
    plate.firstElementChild.className = 'work-preview-picture';
    Object.defineProperties(plate, {
      clientWidth: { get: () => width },
      clientHeight: { value: 160 },
    });
    Object.defineProperty(plate.firstElementChild, 'clientHeight', { get: () => pictureHeight });
  }
  let resize;
  const observed = [];
  const ResizeObserver = class {
    constructor(callback) {
      resize = callback;
    }
    observe(plate) {
      observed.push(plate);
    }
  };
  installGlobals(t, { ResizeObserver });
  observePreviewLayout(plates);
  assert.deepEqual(observed, plates);
  const scales = () =>
    plates.map((plate) => Number(plate.style.getPropertyValue('--preview-scale')));
  resize();
  assert.equal(new Set(scales()).size, 1);
  assert.ok(Math.abs(scales()[0] - 160 / 539) < Number.EPSILON);

  // Desktop artwork can use existing vertical padding without resizing its link or row.
  width = 400;
  pictureHeight = 539;
  resize();
  assert.equal(new Set(scales()).size, 1);
  assert.ok(Math.abs(scales()[0] - 400 / 716) < Number.EPSILON);
  for (const plate of plates) {
    assert.equal(plate.style.getPropertyValue('height'), '');
    assert.equal(plate.style.getPropertyValue('width'), '');
    assert.equal(plate.style.getPropertyValue('padding'), '');
  }
});
