import assert from 'node:assert/strict';
import test from 'node:test';
import { routes } from '../../src/data/navigation.ts';
import { researchFigures, figurePaths, workPreviews } from '../../src/data/research/figures.ts';
import { researchFigureSchema } from '../../src/data/schema.ts';

test('figure fitting, preview canvases and links all come from the validated artwork record', () => {
  const anchors = new Set();
  const projects = new Set();
  for (const [kind, figure] of Object.entries(researchFigures)) {
    researchFigureSchema.parse(figure);
    assert.equal(anchors.has(figure.anchor), false);
    assert.equal(projects.has(figure.project), false);
    anchors.add(figure.anchor);
    projects.add(figure.project);
    assert.equal(figurePaths[kind], figure.src);
    assert.deepEqual(workPreviews[figure.project], {
      src: figure.src,
      href: `${routes.research}#${figure.anchor}`,
      ...figure.canvas,
    });
    assert.equal(figure.canvas.width - 2 * figure.canvas.bleed, 588);
  }
});

test('invalid fitting geometry is rejected before an iframe reaches the browser', () => {
  const figure = researchFigures.gpu;
  assert.equal(
    researchFigureSchema.safeParse({ ...figure, canvas: { width: 10, height: 10, bleed: 5 } })
      .success,
    false,
  );
  assert.equal(
    researchFigureSchema.safeParse({ ...figure, fitting: { compactAt: 0, compactCanvas: null } })
      .success,
    false,
  );
});
