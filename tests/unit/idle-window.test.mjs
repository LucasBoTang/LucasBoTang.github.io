import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForIdleWindow } from '../../src/components/catalogue/FigureWarmup/idle-window.ts';
import { installGlobals } from '../helpers/browser.mjs';

const flush = () => new Promise((resolve) => setImmediate(resolve));

for (const idleAvailable of [true, false]) {
  test(`warm-up rechecks queued work and resumes only when quiet (idle API: ${idleAvailable})`, async (t) => {
    const timers = [];
    const idle = [];
    let quiet = true;
    let completed = false;
    installGlobals(t, {
      setTimeout: (callback) => timers.push(callback),
      requestIdleCallback: idleAvailable ? (callback) => idle.push(callback) : undefined,
    });
    const work = waitForIdleWindow(() => quiet).then(() => {
      completed = true;
    });
    quiet = false; // User resumes input or hides the page while the callback is queued.
    (idleAvailable ? idle : timers).shift()();
    await flush();
    assert.equal(completed, false);
    timers.shift()();
    await flush();
    assert.equal(completed, false);
    quiet = true;
    timers.shift()();
    await flush();
    (idleAvailable ? idle : timers).shift()();
    await work;
    assert.equal(completed, true);
  });
}
