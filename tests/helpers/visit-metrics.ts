import { writeFile } from 'node:fs/promises';
import type { Page, TestInfo } from '@playwright/test';

type Task = {
  duration: number;
  name: string;
  observerPath: string;
  observerWarmup: boolean;
  observerTop: boolean;
  start: number;
  attribution: unknown;
};
type VisitMetrics = {
  tasks: Task[];
  paints: { name: string; time: number }[];
  longFrames: unknown[];
};
type MeasuredWindow = Window & { visitMetrics: VisitMetrics };

/** Include child documents before they are removed, without adding work to production. */
export async function trackVisit(page: Page, cpuRate = 4) {
  await page.addInitScript(() => {
    const host = window.top as unknown as MeasuredWindow;
    if (window === window.top) host.visitMetrics = { tasks: [], paints: [], longFrames: [] };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        host.visitMetrics.tasks.push({
          duration: entry.duration,
          name: entry.name,
          start: performance.timeOrigin + entry.startTime,
          attribution: entry.toJSON().attribution,
          observerPath: location.pathname,
          observerWarmup: Boolean(window.frameElement?.closest('[data-figure-warmup]')),
          observerTop: window === window.top,
        });
    }).observe({ type: 'longtask', buffered: true });
    if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame'))
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          host.visitMetrics.longFrames.push({ observerPath: location.pathname, ...entry.toJSON() });
      }).observe({ type: 'long-animation-frame', buffered: true });
    if (window === window.top)
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          host.visitMetrics.paints.push({ name: entry.name, time: entry.startTime });
      }).observe({ type: 'paint', buffered: true });
  });
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  return session;
}

export async function visitReport(page: Page, info: TestInfo, conditions: Record<string, unknown>) {
  const measurements = await page.evaluate(() => {
    const metrics = (window as unknown as MeasuredWindow).visitMetrics;
    return {
      ...metrics,
      navigation: performance.getEntriesByType('navigation').map((entry) => entry.toJSON()),
    };
  });
  const maxTask = Math.max(0, ...measurements.tasks.map((task) => task.duration));
  const interactionStart = conditions.interactionStartEpochMs;
  const maxInteractionTask =
    typeof interactionStart === 'number'
      ? Math.max(
          0,
          ...measurements.tasks
            .filter((task) => task.start + task.duration >= interactionStart)
            .map((task) => task.duration),
        )
      : null;
  const report = { conditions, maxTask, maxInteractionTask, ...measurements };
  const path = info.outputPath('visit-performance.json');
  await writeFile(path, JSON.stringify(report, null, 2));
  await info.attach('visit-performance.json', {
    path,
    contentType: 'application/json',
  });
  console.log(
    JSON.stringify({
      conditions,
      maxTask,
      maxInteractionTask,
      paints: measurements.paints,
      longestTasks: [...measurements.tasks].sort((a, b) => b.duration - a.duration).slice(0, 3),
    }),
  );
  return report;
}
