import { expect, test } from "@playwright/test";

import {
  buildArchiveChapterZip,
  buildArchivePageList,
  injectArchivePagesFixture,
  installPerfCollectors,
  readSidebarDecodeCounts,
  readSidebarDomNodeCount,
  runSidebarScrollProbe,
  setPerfThemeFamilyClassic,
  writeProbeJson,
} from "./perf-probe-helpers";

test.use({
  viewport: { width: 1760, height: 1320 },
  deviceScaleFactor: 1,
});

const SIDEBAR_PAGES = 50;
const PAGE_WIDTH = 800;
const PAGE_HEIGHT = 1200;
const SCROLL_DELTA_PER_FRAME = 900;
const MAX_SCROLL_FRAMES = 120;

test(
  "F8 baseline — sidebar DOM nodes, scroll FPS, full-page decodes on 50-page archive",
  async ({ page }) => {
    test.setTimeout(300_000);

    await installPerfCollectors(page);

    await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(2000);
    await setPerfThemeFamilyClassic(page);

    const zip = buildArchiveChapterZip(
      buildArchivePageList(SIDEBAR_PAGES, PAGE_WIDTH, PAGE_HEIGHT),
    );
    const pages = await injectArchivePagesFixture(page, {
      zipBase64: zip.base64,
      mimeType: "image/png",
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
    expect(pages, "fixture page count").toHaveLength(SIDEBAR_PAGES);

    const list = page.locator(".koma-files__list");
    await expect(list).toBeVisible();

    const decodesBeforeScroll = await readSidebarDecodeCounts(
      page,
      PAGE_WIDTH,
    );

    const scroll = await runSidebarScrollProbe(page, {
      deltaPerFrame: SCROLL_DELTA_PER_FRAME,
      maxFrames: MAX_SCROLL_FRAMES,
    });

    let decodesAfterScroll = await readSidebarDecodeCounts(page, PAGE_WIDTH);
    for (let settle = 0; settle < 10; settle += 1) {
      await page.waitForTimeout(500);
      const next = await readSidebarDecodeCounts(page, PAGE_WIDTH);
      if (
        next.fullPageDecodes === decodesAfterScroll.fullPageDecodes &&
        next.thumbnailDecodes === decodesAfterScroll.thumbnailDecodes
      ) {
        decodesAfterScroll = next;
        break;
      }
      decodesAfterScroll = next;
    }

    const sidebarDomNodes = await readSidebarDomNodeCount(page);

    const metrics = {
      fixture: "archive-50-pages-800x1200",
      archiveBacked: true,
      thumbnailsAtImport: false,
      pages: SIDEBAR_PAGES,
      sidebarDomNodes,
      scroll: {
        deltaPerFrame: SCROLL_DELTA_PER_FRAME,
        frames: scroll.frames,
        elapsedMs: Math.round(scroll.elapsedMs * 100) / 100,
        fps: Math.round(scroll.fps * 100) / 100,
        gapMeanMs: Math.round(scroll.gapMeanMs * 100) / 100,
        gapP95Ms: Math.round(scroll.gapP95Ms * 100) / 100,
        gapMaxMs: Math.round(scroll.gapMaxMs * 100) / 100,
      },
      decodesBeforeScroll,
      decodesAfterScroll,
    };
    console.log(`PERF_SIDEBAR_SCROLL ${JSON.stringify({
      sidebarDomNodes: metrics.sidebarDomNodes,
      scroll: metrics.scroll,
      decodesBeforeScroll: metrics.decodesBeforeScroll,
      decodesAfterScroll: metrics.decodesAfterScroll,
    })}`);
    const outputPath = writeProbeJson("perf-sidebar-scroll.json", {
      ...metrics,
      capturedAt: new Date().toISOString(),
    });

    expect(
      metrics.decodesBeforeScroll.fullPageDecodes,
      "baseline fixture has no thumbnails, so reveal decodes full pages",
    ).toBeGreaterThan(0);
    expect(
      metrics.decodesAfterScroll.sidebarImgCount,
      "every fixture page has a sidebar thumb img",
    ).toBe(SIDEBAR_PAGES);
    expect(outputPath, "probe output written").toContain("perf-sidebar-scroll");
  },
);

test(
  "F8 real-archive state — zero-decode-at-import baseline (real import path)",
  async ({ page }) => {
    test.setTimeout(300_000);

    await installPerfCollectors(page);

    await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(2000);
    await setPerfThemeFamilyClassic(page);

    const zip = buildArchiveChapterZip(
      buildArchivePageList(SIDEBAR_PAGES, PAGE_WIDTH, PAGE_HEIGHT),
    );
    const pages = await injectArchivePagesFixture(page, {
      zipBase64: zip.base64,
      mimeType: "image/png",
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      residentUrls: false,
    });
    expect(pages).toHaveLength(SIDEBAR_PAGES);

    const list = page.locator(".koma-files__list");
    await expect(list).toBeVisible();

    const decodesBeforeScroll = await readSidebarDecodeCounts(page, PAGE_WIDTH);
    const scroll = await runSidebarScrollProbe(page, {
      deltaPerFrame: SCROLL_DELTA_PER_FRAME,
      maxFrames: MAX_SCROLL_FRAMES,
    });
    let decodesAfterScroll = await readSidebarDecodeCounts(page, PAGE_WIDTH);
    for (let settle = 0; settle < 10; settle += 1) {
      await page.waitForTimeout(500);
      const next = await readSidebarDecodeCounts(page, PAGE_WIDTH);
      if (
        next.fullPageDecodes === decodesAfterScroll.fullPageDecodes &&
        next.thumbnailDecodes === decodesAfterScroll.thumbnailDecodes
      ) {
        decodesAfterScroll = next;
        break;
      }
      decodesAfterScroll = next;
    }
    const sidebarDomNodes = await readSidebarDomNodeCount(page);

    const metrics = {
      fixture: "archive-50-pages-real-import",
      archiveBacked: true,
      residentUrls: false,
      pages: SIDEBAR_PAGES,
      sidebarDomNodes,
      scroll,
      decodesBeforeScroll,
      decodesAfterScroll,
    };
    console.log(`PERF_SIDEBAR_REAL ${JSON.stringify({
      sidebarDomNodes: metrics.sidebarDomNodes,
      scroll: metrics.scroll,
      decodesBeforeScroll: metrics.decodesBeforeScroll,
      decodesAfterScroll: metrics.decodesAfterScroll,
    })}`);
    writeProbeJson("perf-sidebar-real.json", {
      ...metrics,
      capturedAt: new Date().toISOString(),
    });

    expect(
      metrics.decodesBeforeScroll.fullPageDecodes,
      "real archive import decodes nothing at reveal",
    ).toBe(0);
    expect(
      metrics.decodesAfterScroll.fullPageDecodes,
      "scrolling an unmaterialized archive sidebar decodes nothing",
    ).toBe(0);
  },
);
