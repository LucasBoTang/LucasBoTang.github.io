import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';
import { gpuDieHighlights } from '../../src/components/catalogue/GpuFigure/gpu-hardware-layout.ts';

// Check against the bitmap, so replacing the artwork cannot silently leave stale glow anchors.
test('GPU chip highlights land on the current artwork’s metallic die faces', async () => {
  const image = fileURLToPath(
    new URL('../../src/assets/research/gpu-platform-refined.png', import.meta.url),
  );
  const { data, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (const { face, reflection } of gpuDieHighlights) {
    const samples = [...face, ...reflection];
    face.forEach((point, index) => {
      const next = face[(index + 1) % face.length];
      samples.push([(point[0] + next[0]) / 2, (point[1] + next[1]) / 2]);
    });
    for (const [x, y] of samples) {
      const index = (Math.round(y) * info.width + Math.round(x)) * info.channels;
      const rgb = [...data.subarray(index, index + 3)];
      assert.ok(
        Math.min(...rgb) > 140 && Math.max(...rgb) - Math.min(...rgb) < 35,
        `Highlight at (${x}, ${y}) misses the silver die: ${rgb.join(', ')}`,
      );
    }
  }
});
