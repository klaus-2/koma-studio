import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import {
  buildArchiveChapterZip,
  buildArchivePageList,
  injectArchivePagesFixture,
  injectPerfRegions,
  setPerfAioManualStageAtRender,
  setPerfShellMode,
  setPerfThemeFamilyClassic,
} from "./perf-probe-helpers";

test.use({
  viewport: { width: 1760, height: 1320 },
  deviceScaleFactor: 1,
});

const GOLDEN_PAGES = 6;
const PAGE_WIDTH = 800;
const PAGE_HEIGHT = 1200;
const REGIONS_PER_PAGE = 6;
const GOLDEN_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
  "perf-golden",
);

const buildRegions = (imageIndex: number) =>
  Array.from({ length: REGIONS_PER_PAGE }, (_, regionIndex) => {
    const top = 60 + regionIndex * 170;
    return {
      id: `golden-region-${imageIndex + 1}-${regionIndex + 1}`,
      bbox: [60, top, 740, top + 150] as [number, number, number, number],
      renderText: `GOLDEN PAGE ${imageIndex + 1} LINE ${regionIndex + 1}`,
    };
  });

const captureRenderCanvasPng = async (page: import("@playwright/test").Page): Promise<PNG> => {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      ".koma-preview-card__canvasWrap canvas.koma-render-canvas",
    );
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  });
  expect(dataUrl, "render canvas present").not.toBeNull();
  const base64 = (dataUrl as string).split(",")[1] ?? "";
  return PNG.sync.read(Buffer.from(base64, "base64"));
};

test(
  "F2/F5 seam parity — typesetter render canvas golden",
  async ({ page }) => {
    test.setTimeout(240_000);

    await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(2000);
    await setPerfThemeFamilyClassic(page);

    const zip = buildArchiveChapterZip(
      buildArchivePageList(GOLDEN_PAGES, PAGE_WIDTH, PAGE_HEIGHT),
    );
    const pages = await injectArchivePagesFixture(page, {
      zipBase64: zip.base64,
      mimeType: "image/png",
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
    expect(pages).toHaveLength(GOLDEN_PAGES);

    await injectPerfRegions(page, {
      regionsByImage: pages.map((pageInfo, index) => ({
        imageId: pageInfo.id,
        regions: buildRegions(index),
      })),
    });

    await setPerfShellMode(page, "aio");
    await setPerfAioManualStageAtRender(page, pages[0]?.id ?? "");

    const firstBox = page.locator(
      '.koma-render-box[data-region-id="golden-region-1-1"]',
    );
    await expect(firstBox).toBeVisible();
    let painted = false;
    for (let attempt = 0; attempt < 20 && !painted; attempt += 1) {
      const png = await captureRenderCanvasPng(page);
      let nonBlank = 0;
      for (let i = 3; i < png.data.length; i += 4) {
        if (png.data[i] !== 0) nonBlank += 1;
      }
      painted = nonBlank > 1000;
      if (!painted) await page.waitForTimeout(500);
    }
    expect(painted, "render canvas painted content within 10s").toBe(true);

    await page.waitForTimeout(800);
    const captured = await captureRenderCanvasPng(page);

    fs.mkdirSync(GOLDEN_DIR, { recursive: true });
    const goldenPath = path.join(GOLDEN_DIR, "render-canvas-golden.png");
    if (!fs.existsSync(goldenPath)) {
      fs.writeFileSync(goldenPath, PNG.sync.write(captured));
      console.log(
        `PERF_RENDER_GOLDEN recorded baseline ${goldenPath} (${captured.width}x${captured.height})`,
      );
      return;
    }

    const golden = PNG.sync.read(fs.readFileSync(goldenPath));
    expect(
      { w: captured.width, h: captured.height },
      "golden dimensions match",
    ).toEqual({ w: golden.width, h: golden.height });
    const diff = new PNG({ width: golden.width, height: golden.height });
    const diffPixels = pixelmatch(
      golden.data,
      captured.data,
      diff.data,
      golden.width,
      golden.height,
      { threshold: 0 },
    );
    console.log(
      `PERF_RENDER_GOLDEN diff_pixels=${diffPixels} of ${golden.width * golden.height}`,
    );
    expect(diffPixels, "seam parity: pixel diff must be 0").toBe(0);
  },
);
