import { expect, test } from "@playwright/test";

import {
  injectPerfRegions,
  injectTallPageFixture,
  installPerfCollectors,
  markPerfClock,
  readCanvasCensus,
  readFrameWindow,
  readLongTaskWindow,
  readOverlayBoxCount,
  setPerfAioManualStageAtRender,
  setPerfShellMode,
  setPerfThemeFamilyClassic,
  writeProbeJson,
} from "./perf-probe-helpers";

test.use({
  viewport: { width: 1760, height: 1320 },
  deviceScaleFactor: 1,
});

const STRIP_WIDTH = 800;
const STRIP_HEIGHT = 20000;
const REGION_COUNT = 40;
const DRAG_STEPS = 20;
const DRAG_STEP_MS = 40;
const DRAG_STEP_DX = 15;
const DRAG_STEP_DY = 7.5;

interface StripRegion {
  readonly id: string;
  readonly bbox: [number, number, number, number];
  readonly renderText: string;
}

const buildStripRegions = (): StripRegion[] =>
  Array.from({ length: REGION_COUNT }, (_, index) => {
    const top = 60 + index * 495;
    return {
      id: `perf-strip-region-${index + 1}`,
      bbox: [50, top, 750, top + 420],
      renderText: `KOMA STRIP LINE ${index + 1}`,
    };
  });

test(
  "F5 baseline — rAF paint, overlay nodes, backing store on 800x20000",
  async ({ page }) => {
    test.setTimeout(300_000);

    await installPerfCollectors(page);

    await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(2000);
    await setPerfThemeFamilyClassic(page);

    const strip = await injectTallPageFixture(page, {
      width: STRIP_WIDTH,
      height: STRIP_HEIGHT,
    });
    await injectPerfRegions(page, {
      regionsByImage: [
        { imageId: strip.id, regions: buildStripRegions() },
      ],
    });

    await setPerfShellMode(page, "aio");
    await setPerfAioManualStageAtRender(page, strip.id);

    const firstBox = page.locator(
      '.koma-render-box[data-region-id="perf-strip-region-1"]',
    );
    await expect(firstBox).toBeVisible();

    const domDiag = await page.evaluate(() => {
      const wrap = document.querySelector('.koma-preview-card__canvasWrap');
      const stage = wrap?.closest('.koma-stage');
      return {
        hasWrap: Boolean(wrap),
        hasStage: Boolean(stage),
        stageScrollTop: stage instanceof HTMLElement ? stage.scrollTop : -1,
        stageScrollHeight: stage instanceof HTMLElement ? stage.scrollHeight : -1,
        stageClientHeight: stage instanceof HTMLElement ? stage.clientHeight : -1,
      };
    });
    console.log('DIAG', JSON.stringify(domDiag));
    const staticOverlayBoxes = await readOverlayBoxCount(page);
    const canvasCensus = await readCanvasCensus(page);
    const backingStoreBytes = canvasCensus.reduce(
      (sum, canvas) => sum + canvas.bytes,
      0,
    );

    await firstBox.click();
    await expect(firstBox).toHaveClass(/koma-render-box--selected/);

    const boxRect = await firstBox.boundingBox();
    expect(boxRect, "strip region bounding box").not.toBeNull();
    if (!boxRect) throw new Error("perf probe: no strip region rect");

    const gestureStart = await markPerfClock(page);
    await page.mouse.down();
    for (let step = 1; step <= DRAG_STEPS; step += 1) {
      await page.mouse.move(
        boxRect.x + boxRect.width / 2 + step * DRAG_STEP_DX,
        boxRect.y + boxRect.height / 2 + step * DRAG_STEP_DY,
      );
      await page.waitForTimeout(DRAG_STEP_MS);
    }
    await page.mouse.up();
    await page.waitForTimeout(600);
    const frameStats = await readFrameWindow(page, gestureStart);
    const gestureLongTasks = await readLongTaskWindow(page, gestureStart);

    const metrics = {
      fixture: "synthetic-800x20000-strip",
      devicePixelRatio: 1,
      regionCount: REGION_COUNT,
      staticOverlayBoxes,
      backingStoreBytes,
      backingStoreMB:
        Math.round((backingStoreBytes / (1024 * 1024)) * 100) / 100,
      canvasCensus,
      gesture: {
        steps: DRAG_STEPS,
        stepMs: DRAG_STEP_MS,
        frameCount: frameStats.count,
        callbackMeanMs: Math.round(frameStats.callbackMeanMs * 100) / 100,
        callbackP50Ms: Math.round(frameStats.callbackP50Ms * 100) / 100,
        callbackP95Ms: Math.round(frameStats.callbackP95Ms * 100) / 100,
        callbackMaxMs: Math.round(frameStats.callbackMaxMs * 100) / 100,
        gapMeanMs: Math.round(frameStats.gapMeanMs * 100) / 100,
        gapP95Ms: Math.round(frameStats.gapP95Ms * 100) / 100,
        gapMaxMs: Math.round(frameStats.gapMaxMs * 100) / 100,
      },
      gestureLongTasks,
    };
    console.log(`PERF_CANVAS_PAINT ${JSON.stringify({
      staticOverlayBoxes: metrics.staticOverlayBoxes,
      backingStoreMB: metrics.backingStoreMB,
      gesture: metrics.gesture,
      gestureLongTasks: metrics.gestureLongTasks,
    })}`);
    const outputPath = writeProbeJson("perf-canvas-paint.json", {
      ...metrics,
      capturedAt: new Date().toISOString(),
    });

    expect(
      metrics.staticOverlayBoxes,
      "overlay boxes are viewport-culled below the region count",
    ).toBeLessThan(REGION_COUNT);
    expect(metrics.staticOverlayBoxes).toBeGreaterThan(0);
    expect(
      metrics.gesture.frameCount,
      "gesture drove sustained animation frames",
    ).toBeGreaterThan(10);
    expect(outputPath, "probe output written").toContain("perf-canvas-paint");
  },
);
