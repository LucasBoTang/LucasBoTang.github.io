import assert from 'node:assert/strict';
import test from 'node:test';
import { installGlobals } from '../helpers/browser.mjs';
import { registerTypeScriptImports } from '../helpers/typescript-imports.mjs';

const hooks = registerTypeScriptImports();
let prepareModuleFrame;
let updateFlow;
try {
  ({ prepareModuleFrame } = await import('../../src/components/catalogue/DflFigure/drawing.ts'));
  ({ updateFlow } = await import('../../src/components/catalogue/DflFigure/flow-motion.ts'));
} finally {
  hooks.deregister();
}

function surface(width) {
  let scale = 1;
  const clears = [];
  const context = {
    setTransform(a) {
      scale = a;
    },
    clearRect(...rect) {
      clears.push(rect);
    },
    translate() {},
    scale(x) {
      scale *= x;
    },
    getTransform() {
      return { a: scale, b: 0 };
    },
  };
  return {
    canvas: { width: 0, height: 0, dataset: { module: 'optimize-0' } },
    ctx: context,
    box: { width, height: 210 },
    formula: null,
    clears,
  };
}

test('DFL frame scaling preserves CSS-pixel strokes through DPR, geometry scale, and resize', (t) => {
  installGlobals(t, { devicePixelRatio: 1 });
  const frameSurface = surface(0);
  assert.equal(prepareModuleFrame(frameSurface), undefined);
  assert.equal(frameSurface.clears.length, 0);
  for (const dpr of [1, 1.5, 2, 3]) {
    globalThis.devicePixelRatio = dpr;
    for (const width of [165, 280, 220]) {
      frameSurface.box.width = width;
      const drawing = prepareModuleFrame(frameSurface);
      const scale = Math.min(width / 280, 0.85);
      assert.equal(frameSurface.canvas.width, Math.round(width * Math.min(dpr, 2)));
      assert.deepEqual(frameSurface.clears.at(-1), [0, 0, width, 210]);
      assert.ok(Math.abs(drawing.screenStroke(2.4) * scale - 2.4) < 1e-12);
      frameSurface.ctx.scale(0.46);
      drawing.refreshStrokeScale();
      assert.ok(Math.abs(drawing.screenStroke(2.4) * scale * 0.46 - 2.4) < 1e-12);
    }
  }
});

function element() {
  const attributes = {};
  return {
    style: {
      setProperty(name, value) {
        this[name] = value;
      },
    },
    dataset: {},
    attributes,
    setAttribute(name, value) {
      attributes[name] = value;
    },
    getPointAtLength(distance) {
      return { x: distance, y: distance / 2 };
    },
  };
}

function flowFigure() {
  const wire = {
    band: element(),
    gradient: element(),
    length: 200,
    window: [0, 2],
    reverse: [4, 6],
    label: element(),
    glow: element(),
    labelAt: 0.5,
    extent: 80,
    angle: 90,
  };
  const caption = {
    label: element(),
    glow: element(),
    events: [
      { start: 0, end: 2, reverse: false },
      { start: 4, end: 6, reverse: true },
    ],
  };
  return { root: element(), wires: [wire], captions: [caption] };
}

test('DFL return light reverses the wire gradient and caption sweep without moving their geometry', () => {
  const figure = flowFigure();
  const [wire] = figure.wires;
  const [caption] = figure.captions;
  updateFlow(figure, 1, false);
  assert.deepEqual(wire.gradient.attributes, { x1: '52', y1: '26', x2: '100', y2: '50' });
  assert.equal(wire.band.style.strokeDasharray, '48 600');
  assert.equal(wire.band.style.opacity, '0.95');
  assert.equal(wire.label.style['--sweep-angle'], '90deg');
  assert.equal(caption.label.style['--name-sweep'], '50%');
  updateFlow(figure, 5, false);
  assert.deepEqual(wire.gradient.attributes, { x1: '148', y1: '74', x2: '100', y2: '50' });
  assert.equal(wire.label.style['--sweep-angle'], '90deg');
  updateFlow(figure, 4.5, false);
  assert.equal(caption.label.style['--name-sweep'], '87.5%');
});

test('DFL static frames clear active light and resume without stale opacity', () => {
  const figure = flowFigure();
  const [wire] = figure.wires;
  const [caption] = figure.captions;
  updateFlow(figure, 1, false);
  assert.equal(wire.glow.style.opacity, '1');
  assert.equal(caption.glow.style.opacity, '1');
  updateFlow(figure, 1, true);
  assert.equal(wire.band.style.opacity, '0');
  assert.equal(wire.glow.style.opacity, '0');
  assert.equal(caption.glow.style.opacity, '0');
  updateFlow(figure, 1, false);
  assert.equal(wire.band.style.opacity, '0.95');
  assert.equal(wire.glow.style.opacity, '1');
  assert.equal(caption.glow.style.opacity, '1');
  updateFlow(figure, 7, false);
  assert.equal(wire.band.style.opacity, '0');
  assert.equal(wire.glow.style.opacity, '0');
  assert.equal(caption.glow.style.opacity, '0');
});
