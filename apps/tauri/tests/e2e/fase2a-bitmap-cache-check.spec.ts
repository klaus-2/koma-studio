import { expect, test, type Page } from "@playwright/test";

// Fase-2a remount probe (refactor-queue.md section 6) — temporary, untracked.
// The interaction sweep visits each mode once, so it cannot see remount-path
// effects. This probe measures the aio ⇄ typesetter REMOUNT path for the
// RenderTextPreview stage: long tasks per switch, pixel-exact reproduction
// across remounts, and (through a real app-path region drag + stage away +
// remount) that a changed region state is never served stale. Kept as the
// A/B instrument for stage-mount fases (2a bitmap cache measured with it:
// cache on/off medians were within noise — see refactor-queue fase 2a
// outcome; the stats hook `__fase2a` no-ops without cache instrumentation).
//
// Run (from apps/tauri): bunx playwright test tests/e2e/fase2a-bitmap-cache-check.spec.ts --project=chromium --workers=1
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

// Three NON-OVERLAPPING y-bands so per-region pixel windows can be asserted
// independently (the sweep fixture's regions overlap horizontally).
const REGIONS = [
  { id: "probe-region-1", bbox: [200, 150, 900, 300], renderText: "REGION ONE TEXT" },
  { id: "probe-region-2", bbox: [200, 400, 900, 550], renderText: "REGION TWO TEXT" },
  { id: "probe-region-3", bbox: [200, 650, 900, 800], renderText: "REGION THREE TEXT" },
] as const;

// Image-space sample windows (canvas backing = 1600x1200).
const BAND_ONE = { x: 220, y: 170, w: 660, h: 110 };
const BAND_TWO = { x: 220, y: 420, w: 660, h: 110 };
const BAND_THREE = { x: 220, y: 670, w: 660, h: 110 };
// Landing window of region one after the drag (+500 image px x, +400 y).
const BAND_ONE_MOVED = { x: 700, y: 560, w: 660, h: 130 };

// Canvas displays at imageMaxWidth 960 for a 1600px image → scale 0.6.
// 20 steps x (15,12) CSS px = (300,240) CSS px = (500,400) image px.
const DRAG_STEPS = 20;
const DRAG_STEP_DX = 15;
const DRAG_STEP_DY = 12;

test.use({
  viewport: { width: 1760, height: 1320 },
  launchOptions: probeLaunchOptions(),
});

const mass = (page: Page, band: typeof BAND_ONE): Promise<number> =>
  sampleCanvasMass(page, band.x, band.y, band.w, band.h);

// Real app-path region edit: select the region box, drag it +500/+400 image
// px, release. The pointerup commit flows through updateRegionBox →
// onRegionsChange → the region store AND the pipeline snapshots.
const dragRegionOne = async (page: Page): Promise<void> => {
  const box = page.locator('.koma-render-box[data-region-id="probe-region-1"]');
  await expect(box).toBeVisible();
  await box.click();
  await expect(box).toHaveClass(/koma-render-box--selected/);
  const rect = await box.boundingBox();
  expect(rect, "region box rect").not.toBeNull();
  if (!rect) throw new Error("probe: no box rect");
  await page.mouse.down();
  for (let step = 1; step <= DRAG_STEPS; step += 1) {
    await page.mouse.move(
      rect.x + rect.width / 2 + step * DRAG_STEP_DX,
      rect.y + rect.height / 2 + step * DRAG_STEP_DY,
    );
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
};

test("fase2a raster cache — aio/typesetter remounts blit, drags invalidate", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const problems = collectProblems(page);
  await installLongTaskCollector(page);

  await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(2000);
  const gpu = await logGpuMode(page, "fase2a-cache");
  // Instrumented run: count actual blit/save executions in canvasDrawing.
  await page.evaluate(() => {
    (window as unknown as { __fase2a?: { blits: number; saves: number } }).__fase2a = {
      blits: 0,
      saves: 0,
    };
  });

  await injectProbeFixture(
    page,
    REGIONS.map((region) => ({ ...region, bbox: [...region.bbox] as [number, number, number, number] })),
  );
  // Enter aio+manual FIRST (its one-time snapshot normalization resets
  // per-image manual progress), THEN jump the image to the render stage —
  // same order the text-follow probe uses. The RenderTextPreview mount that
  // follows is the first paint (cache miss) and is measured.
  await setShellMode(page, "aio");
  await page.waitForTimeout(1000);

  const windows: Array<{ label: string; count: number; worst: number }> = [];
  const runWindow = async (label: string, mode: string, settleMs = 900) => {
    const mark = await markLongTasks(page);
    await setShellMode(page, mode);
    await page.waitForTimeout(settleMs);
    const tasks = await collectLongTasksSince(page, mark);
    const worst = worstOf(tasks);
    windows.push({ label, count: tasks.length, worst });
    console.log(`FASE2A ${label}: tasks=${tasks.length} worst=${worst.toFixed(1)}ms`);
  };

  // 1. First aio mount — cache MISS, full paint. Reference pixels.
  {
    const mark = await markLongTasks(page);
    await setProbeManualStageAtRender(page);
    await page.waitForTimeout(900);
    const tasks = await collectLongTasksSince(page, mark);
    windows.push({ label: "aio#1 (miss/paint)", count: tasks.length, worst: worstOf(tasks) });
    console.log(`FASE2A aio#1 (miss/paint): tasks=${tasks.length} worst=${worstOf(tasks).toFixed(1)}ms`);
  }
  await expect(page.locator("canvas.koma-render-canvas")).toHaveCount(1);
  const b1Ref = await mass(page, BAND_ONE);
  const b2Ref = await mass(page, BAND_TWO);
  const b3Ref = await mass(page, BAND_THREE);
  console.log(`FASE2A ref mass b1=${b1Ref} b2=${b2Ref} b3=${b3Ref}`);
  expect(b1Ref, "region one painted").toBeGreaterThan(0);

  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(8, b * 0.02);

  // 2. typesetter remount — same image/regions/style/token → cache HIT (blit).
  await runWindow("typesetter#1 (hit/blit)", "typesetter");
  await expect(page.locator("canvas.koma-render-canvas")).toHaveCount(1);
  const t1b1 = await mass(page, BAND_ONE);
  const t1b2 = await mass(page, BAND_TWO);
  console.log(`FASE2A typesetter#1 mass b1=${t1b1} b2=${t1b2}`);
  expect(near(t1b1, b1Ref), `blit reproduces band one (${t1b1} vs ${b1Ref})`).toBe(true);
  expect(near(t1b2, b2Ref), `blit reproduces band two (${t1b2} vs ${b2Ref})`).toBe(true);

  // 3. Back to aio — HIT again.
  await runWindow("aio#2 (hit/blit)", "aio");
  const a2b1 = await mass(page, BAND_ONE);
  console.log(`FASE2A aio#2 mass b1=${a2b1}`);
  expect(near(a2b1, b1Ref), `blit reproduces band one again (${a2b1} vs ${b1Ref})`).toBe(true);

  // 4. Real drag of region one through the app path (bbox change → new
  // fingerprint), then leave the stage and remount. The cached OLD raster
  // must NOT be served: band one empty, region one visible at its new spot.
  await dragRegionOne(page);
  await page.waitForTimeout(1200);
  const draggedB1 = await mass(page, BAND_ONE);
  const draggedMoved = await mass(page, BAND_ONE_MOVED);
  console.log(`FASE2A after-drag mass b1=${draggedB1} moved=${draggedMoved}`);
  expect(draggedB1, "dragged region left band one").toBeLessThan(8);
  expect(draggedMoved, "dragged region painted at destination").toBeGreaterThan(0);

  await runWindow("organize (stage away)", "organize");
  await runWindow("aio#3 (remount after drag)", "aio");
  const a3b1 = await mass(page, BAND_ONE);
  const a3moved = await mass(page, BAND_ONE_MOVED);
  const a3b2 = await mass(page, BAND_TWO);
  const a3b3 = await mass(page, BAND_THREE);
  console.log(`FASE2A aio#3 mass b1=${a3b1} moved=${a3moved} b2=${a3b2} b3=${a3b3}`);
  expect(a3b1, "stale raster not served after drag (band one empty)").toBeLessThan(8);
  expect(a3moved, "dragged region rendered at destination after remount").toBeGreaterThan(0);
  expect(a3b2, "untouched band two still painted").toBeGreaterThan(0);
  expect(a3b3, "untouched band three still painted").toBeGreaterThan(0);

  // 5. typesetter with the dragged data — hit on the re-cached entry.
  await runWindow("typesetter#2 (hit/blit, dragged data)", "typesetter");
  const t2b1 = await mass(page, BAND_ONE);
  const t2moved = await mass(page, BAND_ONE_MOVED);
  console.log(`FASE2A typesetter#2 mass b1=${t2b1} moved=${t2moved}`);
  expect(t2b1, "dragged band one stays empty across modes").toBeLessThan(8);
  expect(t2moved, "dragged region reproduced across modes").toBeGreaterThan(0);

  const cacheStats = await page.evaluate(() => {
    const stats = (window as unknown as { __fase2a?: { blits: number; saves: number } }).__fase2a;
    return stats ? `${stats.blits} blits / ${stats.saves} saves` : "no stats";
  });
  console.log(`FASE2A cache stats: ${cacheStats}`);
  console.log(`FASE2A_SUMMARY ${JSON.stringify({ gpu: gpu.mode, windows })}`);

  expect(problems, "no pageerrors/app console errors during probe").toEqual([]);
});
