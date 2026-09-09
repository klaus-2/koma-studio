import { expect, test } from "@playwright/test";

// Fase-0 interaction sweep probe (refactor-queue.md section 6) — temporary,
// untracked. Walks the dashboard switching tool modes, selecting regions and
// navigating routes while a PerformanceObserver longtask collector measures
// the slow main-thread tasks each interaction produces. Measurement-only:
// asserts nothing about the numbers, only that the page never errors.
//
// Run (from apps/tauri): bunx playwright test tests/e2e/interaction-sweep-probe.spec.ts --project=chromium --workers=1
// Default runs HEADED (real GPU); SWEEP_HEADLESS=1 falls back to headless.

import {
  collectLongTasksSince,
  collectProblems,
  injectProbeFixture,
  installLongTaskCollector,
  logGpuMode,
  markLongTasks,
  probeLaunchOptions,
  selectProbeRegion,
  setShellMode,
  worstOf,
} from "./probe-helpers";

const MODES = [
  "aio",
  "cleaner",
  "typesetter",
  "translator",
  "raw",
  "proofreader",
  "stitch",
  "split",
  "watermark",
  "enhance",
  "optimizer",
  "organize",
] as const;

test.use({
  viewport: { width: 1760, height: 1320 },
  launchOptions: probeLaunchOptions(),
});

test("interaction sweep — per-interaction long tasks (GPU baseline)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = collectProblems(page);
  await installLongTaskCollector(page);

  await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(2000);
  const gpu = await logGpuMode(page, "interaction-sweep");

  await injectProbeFixture(
    page,
    [1, 2, 3, 4, 5].map((n) => ({
      id: `probe-region-${n}`,
      bbox: [200 + n * 20, 200, 500 + n * 20, 320] as [
        number,
        number,
        number,
        number,
      ],
      renderText: `REGION ${n} TEXT`,
    })),
  );
  await page.waitForTimeout(500);

  const windows: Array<{ label: string; count: number; worst: number }> = [];
  const offenders: Array<{ label: string; worst: number }> = [];

  const runWindow = async (
    label: string,
    action: () => Promise<void>,
    settleMs: number,
  ): Promise<void> => {
    const mark = await markLongTasks(page);
    await action();
    await page.waitForTimeout(settleMs);
    const tasks = await collectLongTasksSince(page, mark);
    const worst = worstOf(tasks);
    windows.push({ label, count: tasks.length, worst });
    console.log(`SWEEP ${label}: tasks=${tasks.length} worst=${worst.toFixed(1)}ms`);
    if (worst > 120) offenders.push({ label, worst });
  };

  for (const mode of MODES) {
    await runWindow(`mode:${mode}`, () => setShellMode(page, mode), 900);
  }
  for (let n = 1; n <= 5; n += 1) {
    await runWindow(
      `region-select:${n}`,
      () => selectProbeRegion(page, `probe-region-${n}`),
      600,
    );
  }
  for (const route of ["settings", "model-rankings", "scanlation-feed", "dashboard"]) {
    await runWindow(
      `route:/#/${route}`,
      async () => {
        await page.goto(`/#/${route}`);
      },
      1200,
    );
  }

  const totalTasks = windows.reduce((sum, window) => sum + window.count, 0);
  console.log(`OFFENDERS ${JSON.stringify(offenders)}`);
  console.log(
    `SWEEP_SUMMARY ${JSON.stringify({
      gpu: gpu.mode,
      webgl2: gpu.webgl2,
      windows,
      totalTasks,
      offenders: offenders.length,
    })}`,
  );

  expect(problems, "no pageerrors/app console errors during sweep").toEqual([]);
});
