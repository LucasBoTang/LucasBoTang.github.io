import { expect, test } from '@playwright/test';
import { routes } from '../../src/data/navigation';
import { waitForOpening, metrics } from '../helpers/steady-motion';
import { trackVisit, visitReport } from '../helpers/visit-metrics';

test.use({ viewport: { width: 1280, height: 900 } });
test.describe('on a slowed CPU', () => {
  test.skip(!!process.env.CI, 'Shared CI machines time too unevenly');

  test('scrolling the home page to its foot keeps tasks within 150ms', async ({ page }, info) => {
    const session = await trackVisit(page, 1);
    await page.goto(routes.home);
    await waitForOpening(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const interactionStartEpochMs = await page.evaluate(
      () => performance.timeOrigin + performance.now(),
    );
    for (let step = 0; step < 40; step++) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(500);
    const report = await visitReport(page, info, {
      scenario: 'scrolling',
      cpuRate: 4,
      interactionStartEpochMs,
    });
    const tasks = report.tasks.filter(
      (task) => task.observerTop && task.start >= interactionStartEpochMs,
    );
    expect(tasks.filter((task) => Math.round(task.duration) > 150)).toEqual([]);
  });

  test('the home page at rest keeps its scripts light', async ({ page }, info) => {
    const session = await trackVisit(page, 1);
    await page.goto(routes.home);
    await waitForOpening(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const read = await metrics(page);
    const before = await read();
    await page.waitForTimeout(4000);
    const after = await read();
    await visitReport(page, info, {
      scenario: 'idle',
      cpuRate: 4,
      scriptDuration: after.ScriptDuration - before.ScriptDuration,
    });
    // About 0.07s of script in these four seconds today; the budget leaves room for a slow run.
    expect(after.ScriptDuration - before.ScriptDuration).toBeLessThan(0.3);
  });
});
