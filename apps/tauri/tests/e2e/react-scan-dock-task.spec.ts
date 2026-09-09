import { expect, test } from "@playwright/test";

// Throwaway diagnostic probe (untracked) — FPS-agent-2, CLICK1 task-body
// breakdown. Wraps the FIRST region selection in PerformanceObserver +
// user-timing marks so the composition of the ~80ms task is visible:
//   - m1 = click dispatch start (Playwright Input.dispatchMouseEvent)
//   - m2 = first post-click rAF (main thread yielded)
//   - m3 = end of settle window
// Sub-marks (injected via store-subscribe callbacks and a render observer):
//   - w:<store>  = last write of each store within the window
//   - r:<Component> = react-scan render flushes of the dock family
// Also samples PerformanceScriptEntry attribution (react-dom vs other).
//
// Run: cd /c/Github/koma/apps/tauri && bunx playwright test tests/e2e/react-scan-dock-task.spec.ts --project=chromium --workers=1

import {
  collectProblems,
  injectProbeFixture,
  probeLaunchOptions,
  setProbeManualStageAtRender,
  setShellMode,
} from "./probe-helpers";

test.use({
  viewport: { width: 1760, height: 1320 },
  launchOptions: probeLaunchOptions(),
});

test("CLICK1 task body breakdown", async ({ page }) => {
  test.setTimeout(240_000);
  const problems = collectProblems(page);

  await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(2500);

  await injectProbeFixture(
    page,
    [1].map((n) => ({
      id: `probe-region-${n}`,
      bbox: [340, 260, 840, 400] as [number, number, number, number],
      renderText: "REGION 1 TEXT",
    })),
  );
  await setShellMode(page, "aio");
  await setProbeManualStageAtRender(page);
  await page.waitForTimeout(900);

  // Task visibility + marks. Uses PerformanceObserver buffered longtasks +
  // performance.mark from injected hooks.
  await page.evaluate(() => {
    const win = window as unknown as {
      __komaTaskLog?: Array<{ name: string; t: number; dur: number }>;
      __komaReactScan?: { mark: (label: string) => void };
    };
    win.__komaTaskLog = [];
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        win.__komaTaskLog?.push({
          name: "longtask",
          t: entry.startTime,
          dur: entry.duration,
        });
      }
    });
    try {
      obs.observe({ entryTypes: ["longtask"], buffered: true });
    } catch {
      // ignore
    }
  });

  const box = page.locator('.koma-render-box[data-region-id="probe-region-1"]');
  await expect(box).toBeVisible();
  const rect = await box.boundingBox();
  expect(rect).not.toBeNull();
  const cx = rect!.x + rect!.width / 2;
  const cy = rect!.y + rect!.height / 2;

  // Click with CDP timestamps: dispatch + rAF markers around the gesture.
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setScriptExecutionDisabled", { value: false });

  await page.evaluate(() => {
    const win = window as unknown as { __komaReactScan?: { mark: (label: string) => void } };
    win.__komaReactScan?.mark("task-body:start");
  });

  const t0 = Date.now();
  await session.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: Math.round(cx),
    y: Math.round(cy),
    button: "left",
    clickCount: 1,
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: Math.round(cx),
    y: Math.round(cy),
    button: "left",
    clickCount: 1,
  });
  const tDispatched = Date.now();

  // Sample the main thread with a series of rAF probes: the first rAF that
  // fires after dispatch tells us when the task(s) ended.
  const probe = await page.evaluate(
    () =>
      new Promise<{ t0: number; rafTime: number; frames: number }>((resolve) => {
        const start = performance.now();
        let frames = 0;
        const tick = (): void => {
          frames += 1;
          if (frames >= 3) {
            resolve({ t0: start, rafTime: performance.now(), frames });
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );

  await page.waitForTimeout(1500);
  const tSettled = Date.now();

  const result = await page.evaluate(() => {
    const win = window as unknown as {
      __komaTaskLog?: Array<{ name: string; t: number; dur: number }>;
      __komaReactScan?: { events: () => Array<{ t: number; name: string | null; count: number; time: number; changes: number }> };
    };
    const events = (win.__komaReactScan?.events() ?? []).filter(
      (e) => e.name && !e.name.startsWith("MARK:"),
    );
    return {
      tasks: win.__komaTaskLog ?? [],
      events: events.map((e) => ({
        t: e.t,
        name: e.name,
        time: e.time,
        changes: e.changes,
      })),
      navStart: performance.timeOrigin,
    };
  });

  const frameMs = probe.rafTime - probe.t0;
  console.log(
    `TASKBODY wall(dispatch→3rAF)=${frameMs.toFixed(1)}ms dispatchMs=${tDispatched - t0} settleMs=${tSettled - tDispatched}`,
  );
  for (const task of result.tasks.slice(-6)) {
    console.log(
      `TASKBODY longtask start=${task.t.toFixed(1)} dur=${task.dur.toFixed(1)}`,
    );
  }
  for (const e of result.events) {
    console.log(
      `TASKBODY render t=${e.t.toFixed(0)} ${e.name} ${e.time.toFixed(1)}ms ch=${e.changes}`,
    );
  }

  expect(problems, "no pageerrors in task-body probe").toEqual([]);
});
