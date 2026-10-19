import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const picture = fileURLToPath(new URL('../../src/assets/portrait-pixels.png', import.meta.url));

test('the portrait pixel picture is one grey channel on its grid, in four tones', async () => {
  const { data, info } = await sharp(picture)
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [170, 255]);
  const tones = new Set(data);
  for (const tone of tones) assert.ok([0, 85, 170, 255].includes(tone), `unexpected tone ${tone}`);
  assert.ok(tones.size >= 3, 'the picture uses its tones');
});
