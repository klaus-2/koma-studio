import { expect, test, type Page } from "@playwright/test";

// Fase-0 drag probe (refactor-queue.md section 6) — temporary, untracked.
// Documents that the canvas rendered text follows the koma-render-box live
// during a drag (alpha-pixel mass decays in the origin window and grows in
// the destination window) and measures the drag vs pointerup-commit long
// tasks separately.
//
// Two tests:
//  1. "full pass" — samples canvas pixels each step (documents the live
//     follow). Skipped when TEXT_FOLLOW_PERF_ONLY=1.
//  2. "perf-only pass" — sets window.__komaNoPixels so getImageData
//     sampling is skipped (pixel readbacks dominate long tasks in software
//     rendering and pollute the measurement); asserts drag-window worst
//     < 50ms. Runs in every invocation.
//
// Run (from apps/tauri): bunx playwright test tests/e2e/text-follow-probe.spec.ts --project=chromium --workers=1
// Default runs HEADED (real GPU); SWEEP_HEADLESS=1 falls back to headless.

import {
  collectLongTasksSince,
  collectProblems,
  injectProbeFixture,
  installLongTaskCollector,
  logGpuMode,
  markLongTasks,
  probeLaunchOptions,
  sampleCanvasMass,
  setProbeManualStageAtRender,
  setShellMode,
  worstOf,
} from "./probe-helpers";

const ORIGIN_WINDOW = { x: 380, y: 280, width: 560, height: 160 };
const DEST_WINDOW = { x: 680, y: 430, width: 620, height: 180 };
const STEPS = 20;
const STEP_DX = 15;
const STEP_DY = 7.5;

test.use({
  viewport: { width: 1760, height: 1320 },
  launchOptions: probeLaunchOptions(),
});

interface DragResult {
  dragWorst: number;
  commitWorst: number;
  dragTasks: Array<{ duration: number; startTime: number }>;
  commitTasks: Array<{ duration: number; startTime: number }>;
  boxDx: number;
  originFirst: number;
  originLast: number;
  destFirst: number;
  destLast: number;
}

// Shared gesture: select (first click), then pointerdown + 20 moves with
// 40ms pauses + pointerup, windowing long tasks into drag vs commit.
const runDragGesture = async (
  page: Page,
  perfOnly: boolean,
): Promise<DragResult> => {
  await injectProbeFixture(page, [
    {
      id: "probe-region-1",
      bbox: [400, 300, 900, 420],
      renderText: "KOMA DRAG TEST TEXT",
    },
  ]);

  await setShellMode(page, "aio");
  // Manual progress starts at detectText — jump to the render stage so the
  // AIO stage mounts RenderTextPreview (owner of .koma-render-box).
  await setProbeManualStageAtRender(page);
  const box = page.locator('.koma-render-box[data-region-id="probe-region-1"]');
  await expect(box).toBeVisible();

  // FIRST CLICK ONLY SELECTS (handlePointerDown returns early while the
  // region is unselected).
  await box.click();
  await expect(box).toHaveClass(/koma-render-box--selected/);

  const rectBefore = await box.boundingBox();
  expect(rectBefore, "box bounding box before drag").not.toBeNull();
  if (!rectBefore) throw new Error("probe: no box rect before drag");

  if (perfOnly) {
    await page.evaluate(() => {
      (window as unknown as { __komaNoPixels?: boolean }).__komaNoPixels = true;
    });
  }

  const dragMark = await markLongTasks(page);
  await page.mouse.down();
  const originSamples: number[] = [];
  let destFirst = -1;
  let destLast = -1;
  if (!perfOnly) {
    originSamples.push(
      await sampleCanvasMass(
        page,
        ORIGIN_WINDOW.x,
        ORIGIN_WINDOW.y,
        ORIGIN_WINDOW.width,
        ORIGIN_WINDOW.height,
      ),
    );
    destFirst = await sampleCanvasMass(
      page,
      DEST_WINDOW.x,
      DEST_WINDOW.y,
      DEST_WINDOW.width,
      DEST_WINDOW.height,
    );
    destLast = destFirst;
  }
  for (let step = 1; step <= STEPS; step += 1) {
    await page.mouse.move(
      rectBefore.x + rectBefore.width / 2 + step * STEP_DX,
      rectBefore.y + rectBefore.height / 2 + step * STEP_DY,
    );
    await page.waitForTimeout(40);
    if (!perfOnly) {
      originSamples.push(
        await sampleCanvasMass(
          page,
          ORIGIN_WINDOW.x,
          ORIGIN_WINDOW.y,
          ORIGIN_WINDOW.width,
          ORIGIN_WINDOW.height,
        ),
      );
      destLast = await sampleCanvasMass(
        page,
        DEST_WINDOW.x,
        DEST_WINDOW.y,
        DEST_WINDOW.width,
        DEST_WINDOW.height,
      );
    }
  }
  const dragTasks = await collectLongTasksSince(page, dragMark);

  const commitMark = await markLongTasks(page);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const commitTasks = await collectLongTasksSince(page, commitMark);

  const rectAfter = await box.boundingBox();
  expect(rectAfter, "box bounding box after drag").not.toBeNull();
  if (!rectAfter) throw new Error("probe: no box rect after drag");

  return {
    dragWorst: worstOf(dragTasks),
    commitWorst: worstOf(commitTasks),
    dragTasks,
    commitTasks,
    boxDx: rectAfter.x - (rectBefore?.x ?? 0),
    originFirst: originSamples[0] ?? -1,
    originLast: originSamples[originSamples.length - 1] ?? -1,
    destFirst,
    destLast,
  };
};

test("text-follow full pass — canvas text follows the box live, drag + commit long tasks", async ({
  page,
}) => {
  test.skip(
    process.env.TEXT_FOLLOW_PERF_ONLY === "1",
    "TEXT_FOLLOW_PERF_ONLY=1 runs the perf-only pass",
  );
  test.setTimeout(120_000);

  const problems = collectProblems(page);
  await installLongTaskCollector(page);

  await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(2000);
  const gpu = await logGpuMode(page, "text-follow-full");

  const result = await runDragGesture(page, false);

  console.log(
    `DRAG_LONGTASKS ${JSON.stringify({
      gpu: gpu.mode,
      count: result.dragTasks.length,
      worst: result.dragWorst,
      tasks: result.dragTasks,
    })}`,
  );
  console.log(
    `COMMIT_LONGTASKS ${JSON.stringify({
      count: result.commitTasks.length,
      worst: result.commitWorst,
      tasks: result.commitTasks,
    })}`,
  );
  console.log(
    `MASS origin ${result.originFirst} -> ${result.originLast} | dest ${result.destFirst} -> ${result.destLast} | boxDx ${result.boxDx.toFixed(1)}px`,
  );

  // Text follows live: origin decays to <40% of the first sample, destination grows.
  expect(result.originFirst, "origin text painted").toBeGreaterThan(0);
  expect(
    result.originLast,
    "origin mass decays to <40% of first",
  ).toBeLessThan(result.originFirst * 0.4);
  expect(result.destLast, "destination mass grows").toBeGreaterThan(
    result.destFirst,
  );
  // The box itself moved >250px x (20 steps x 15px = 300px).
  expect(result.boxDx, "box moved >250px x").toBeGreaterThan(250);

  expect(problems, "no pageerrors during drag").toEqual([]);
});

test("text-follow perf-only pass — drag-window worst < 50ms without pixel sampling", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const problems = collectProblems(page);
  await installLongTaskCollector(page);

  await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(2000);
  const gpu = await logGpuMode(page, "text-follow-perf-only");

  const result = await runDragGesture(page, true);

  console.log(
    `DRAG_LONGTASKS (perf-only) ${JSON.stringify({
      gpu: gpu.mode,
      count: result.dragTasks.length,
      worst: result.dragWorst,
      tasks: result.dragTasks,
    })}`,
  );
  console.log(
    `COMMIT_LONGTASKS (perf-only) ${JSON.stringify({
      count: result.commitTasks.length,
      worst: result.commitWorst,
      tasks: result.commitTasks,
    })}`,
  );
  console.log(`BOX_DX (perf-only) ${result.boxDx.toFixed(1)}px`);

  expect(result.boxDx, "box moved >250px x").toBeGreaterThan(250);
  expect(
    result.dragWorst,
    "drag-window worst long task < 50ms (no pixel sampling)",
  ).toBeLessThan(50);

  expect(problems, "no pageerrors during drag").toEqual([]);
});
