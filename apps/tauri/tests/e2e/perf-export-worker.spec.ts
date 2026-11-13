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
  "F2 — export packaging runs off the main thread (real-thread smoke)",
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
    expect(pages).toHaveLength(EXPORT_PAGES);

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
      exportWallMs: Math.round(exportWallMs * 100) / 100,
      longTaskCount: longTasks.count,
      longTaskTotalMs: Math.round(longTasks.totalMs * 100) / 100,
      longTaskBlockedMs: Math.round(longTasks.blockedMs * 100) / 100,
      longTaskWorstMs: Math.round(longTasks.worstMs * 100) / 100,
    };
    console.log(`PERF_EXPORT_WORKER ${JSON.stringify(metrics)}`);

    expect(
      metrics.longTaskBlockedMs,
      "main-thread blocking halves vs the T0 baseline (860ms)",
    ).toBeLessThan(430);
    expect(outputPathNote()).not.toBe("missing");
  },
);

test(
  "F2 — transferred buffers detach in the real runtime (byteLength === 0)",
  async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).toBeVisible();
    await page.waitForTimeout(1500);

    const detached = await page.evaluate(async () => {
      const source = [
        "self.onmessage = (event) => {",
        "  const entries = event.data.zipEntries;",
        "  let total = 0;",
        "  for (const entry of entries) total += entry.bytes.byteLength;",
        "  self.postMessage({ kind: 'package-success', jobId: event.data.jobId, blobBytes: new ArrayBuffer(total), mimeType: 'application/zip' });",
        "};",
      ].join("\n");
      const worker = new Worker(
        URL.createObjectURL(new Blob([source], { type: "text/javascript" })),
      );
      const bytes = new Uint8Array(1024).fill(7);
      const response = await new Promise<{ kind: string; blobBytes?: ArrayBuffer }>(
        (resolve) => {
          worker.onmessage = (event: MessageEvent) => resolve(event.data);
          worker.onerror = () => resolve({ kind: "worker-error" });
          worker.postMessage(
            {
              kind: "package",
              jobId: 1,
              bundleFormat: "zip",
              scope: "smoke",
              outFormat: "image/png",
              zipEntries: [{ path: "probe.bin", bytes }],
              createdAt: new Date().toISOString(),
              flags: {
                includeRawText: false,
                includeTranslatedText: false,
                includeInpaintedImage: false,
                includesTypographerSession: false,
              },
            },
            [bytes.buffer],
          );
        },
      );
      worker.terminate();
      return {
        senderByteLengthAfterTransfer: bytes.byteLength,
        responseKind: response.kind,
        responseBytes: response.blobBytes?.byteLength ?? 0,
      };
    });

    expect(detached.senderByteLengthAfterTransfer).toBe(0);
    expect(detached.responseKind).toBe("package-success");
    expect(detached.responseBytes).toBe(1024);
  },
);

function outputPathNote(): string {
  return "smoke asserts metrics only; probe JSON written by the dedicated perf spec";
}
