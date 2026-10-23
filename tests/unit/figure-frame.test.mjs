import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { researchFigures } from '../../src/data/research/figures.ts';
import { installGlobals, mediaQuery } from '../helpers/browser.mjs';

let instance = 0;
async function frames(t, desktop = true) {
  const { document } = parseHTML(
    ['gpu', 'dfl', 'l2o']
      .map((kind) => `<div data-scalable-figure="${kind}"><iframe src="/${kind}/"></iframe></div>`)
      .join(''),
  );
  const elements = [...document.querySelectorAll('[data-scalable-figure]')];
  for (const element of elements) {
    const { canvas, fitting } = researchFigures[element.dataset.scalableFigure];
    element.dataset.figureFit = JSON.stringify(fitting);
    for (const [name, value] of Object.entries(canvas))
      element.style.setProperty(`--figure-canvas-${name}`, `${value}px`);
  }
  elements.forEach((element) => Object.defineProperty(element, 'clientWidth', { value: 294 }));
  const reports = new Map();
  const media = mediaQuery(desktop);
  const values = {
    document,
    matchMedia: () => media,
    ResizeObserver: class {
      constructor(report) {
        this.report = report;
      }
      observe(element) {
        reports.set(element, this.report);
      }
    },
  };
  installGlobals(t, values);
  await import(`../../src/components/catalogue/FigureFrame/figure-frame.ts?test=${++instance}`);
  return {
    elements,
    media,
    resize(width) {
      elements.forEach((element) => reports.get(element)([{ contentRect: { width } }]));
    },
  };
}

test('all three canvases scale by their content width, keeping running documents in place', async (t) => {
  const f = await frames(t);
  const documents = f.elements.map((element) => element.querySelector('iframe'));
  for (const element of f.elements) {
    assert.equal(element.style.getPropertyValue('--figure-scale'), '0.5');
    assert.ok(element.hasAttribute('data-scaled'));
  }
  f.resize(420);
  f.elements.forEach((element) =>
    assert.equal(Number(element.style.getPropertyValue('--figure-scale')), 420 / 588),
  );
  f.resize(588);
  f.resize(720);
  f.elements.forEach((element, i) => {
    assert.equal(element.style.getPropertyValue('--figure-scale'), '1');
    assert.equal(element.hasAttribute('data-scaled'), false);
    assert.equal(element.querySelector('iframe'), documents[i]);
    assert.equal(documents[i].getAttribute('src'), `/${element.dataset.scalableFigure}/`);
  });
});

test('crossing the page breakpoint selects compact fitting and restores the desktop canvas', async (t) => {
  const f = await frames(t, false);
  const check = (scale, scaled) =>
    f.elements.forEach((element) => {
      assert.equal(Number(element.style.getPropertyValue('--figure-scale')), scale);
      assert.equal(element.hasAttribute('data-scaled'), scaled);
    });
  const checkCompact = () =>
    f.elements.forEach((element) => {
      const l2o = element.dataset.scalableFigure === 'l2o';
      assert.equal(Number(element.style.getPropertyValue('--figure-scale')), l2o ? 294 / 330 : 1);
      assert.equal(element.hasAttribute('data-scaled'), l2o);
    });
  checkCompact();
  f.media.matches = true;
  f.media.dispatchEvent(new Event('change'));
  check(0.5, true);
  f.resize(0);
  check(1, false);
  f.resize(294);
  check(0.5, true);
  f.media.matches = false;
  f.media.dispatchEvent(new Event('change'));
  checkCompact();
});

test('wider phones retain the desktop canvas; L2O holds its compact proportions below 330px', async (t) => {
  const f = await frames(t, false);
  const l2o = f.elements.find((element) => element.dataset.scalableFigure === 'l2o');
  const dfl = f.elements.find((element) => element.dataset.scalableFigure === 'dfl');
  const document = l2o.querySelector('iframe');
  f.resize(500);
  f.elements.forEach((element) => {
    assert.equal(Number(element.style.getPropertyValue('--figure-scale')), 500 / 588);
    assert.ok(element.hasAttribute('data-scaled'));
  });
  f.resize(421);
  for (const element of [l2o, dfl]) {
    assert.equal(Number(element.style.getPropertyValue('--figure-scale')), 421 / 588);
    assert.equal(element.style.getPropertyValue('--figure-canvas-height'), '539px');
  }
  f.resize(420);
  for (const element of [l2o, dfl]) assert.equal(element.hasAttribute('data-scaled'), false);
  f.resize(270);
  assert.equal(Number(l2o.style.getPropertyValue('--figure-scale')), 270 / 330);
  assert.equal(l2o.style.getPropertyValue('--figure-canvas-width'), '330px');
  assert.equal(l2o.style.getPropertyValue('--figure-canvas-height'), '632px');
  assert.equal(l2o.querySelector('iframe'), document);
});
