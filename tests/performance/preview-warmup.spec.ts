import { test } from '@playwright/test';
import { expectPreviewDuringWarmup } from '../helpers/preview-during-warmup';

test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } });
test('opening a preview during unfinished warm-up on a slowed CPU', async ({ page }, info) => {
  test.skip(!!process.env.CI, 'Shared CI machines cannot provide stable time budgets');
  await expectPreviewDuringWarmup(page, info);
});
