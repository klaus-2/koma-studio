import { expect, test } from "@playwright/test";

import {
  buildArchiveChapterZip,
  buildArchivePageList,
  injectArchivePagesFixture,
  injectPerfRegions,
  installPerfCollectors,
  markPerfClock,
  readLongTaskWindow,
  setPerfShellMode,
  setPerfThemeFamilyClassic,
  writeProbeJson,
} from "./perf-probe-helpers";

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "longtask is Chromium-only",
);

test.use({
  viewport: { width: 1760, height: 1320 },
  deviceScaleFactor: 1,
});

const EXPORT_PAGES = 10;
const PAGE_WIDTH = 800;
const PAGE_HEIGHT = 1200;

test(
  "F2 baseline — long-task blocking during a scripted full export",
  async ({ page }) => {
    test.setTimeout(300_000);

    await installPerfCollectors(page);

    await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(2000);
    await setPerfThemeFamilyClassic(page);

    const zip = buildArchiveChapterZip(
      buildArchivePageList(EXPORT_PAGES, PAGE_WIDTH, PAGE_HEIGHT),
    );
    const pages = await injectArchivePagesFixture(page, {
      zipBase64: zip.base64,
      mimeType: "image/png",
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
    expect(pages, "fixture page count").toHaveLength(EXPORT_PAGES);

    await injectPerfRegions(page, {
      regionsByImage: pages.map((pageInfo, index) => ({
        imageId: pageInfo.id,
        regions: [
          {
            id: `perf-region-${index + 1}`,
            bbox: [50, 40, 750, 320],
            renderText: `KOMA EXPORT PAGE ${index + 1}`,
          },
        ],
      })),
    });

    await setPerfShellMode(page, "typesetter");

    const trigger = page.locator('[data-tour="topbar-download-trigger"]');
    await expect(trigger).toBeEnabled();
    await trigger.click();
    const primaryAction = page.locator(".koma-dlmenu__action--primary");
    await expect(primaryAction).toBeEnabled();

    const exportStarted = await markPerfClock(page);
    const downloadPromise = page.waitForEvent("download", { timeout: 240_000 });
    await primaryAction.click();
    const download = await downloadPromise;
    const exportWallMs = (await markPerfClock(page)) - exportStarted;
    await download.cancel().catch(() => undefined);

    const longTasks = await readLongTaskWindow(page, exportStarted);

    const metrics = {
      fixture: "standard-export-fixture",
      pages: EXPORT_PAGES,
      pageSize: `${PAGE_WIDTH}x${PAGE_HEIGHT}`,
      archiveBacked: true,
      scope: "typesetter",
      exportWallMs: Math.round(exportWallMs * 100) / 100,
      longTaskCount: longTasks.count,
      longTaskTotalMs: Math.round(longTasks.totalMs * 100) / 100,
      longTaskBlockedMs: Math.round(longTasks.blockedMs * 100) / 100,
      longTaskWorstMs: Math.round(longTasks.worstMs * 100) / 100,
    };
    console.log(`PERF_EXPORT_BLOCK ${JSON.stringify(metrics)}`);
    const outputPath = writeProbeJson("perf-export-block.json", {
      ...metrics,
      capturedAt: new Date().toISOString(),
    });

    expect(
      metrics.longTaskCount,
      "export produced at least one long task",
    ).toBeGreaterThan(0);
    expect(outputPath, "probe output written").toContain("perf-export-block");
  },
);
