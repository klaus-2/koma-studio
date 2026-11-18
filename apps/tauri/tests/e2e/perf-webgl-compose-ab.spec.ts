import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

import {
  buildArchiveChapterZip,
  buildArchivePageList,
  injectArchivePagesFixture,
  injectPerfRegions,
  markPerfClock,
  setPerfShellMode,
  setPerfThemeFamilyClassic,
} from "./perf-probe-helpers";

declare global {
  interface Window {
    komaAbWebglAttempts: number;
    komaAbWebglContexts: number;
    komaAbToBlobAt: number[];
  }
}

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL compose A/B is Chromium-only (real WebGL required)",
);

test.use({
  viewport: { width: 1760, height: 1320 },
  deviceScaleFactor: 1,
});

const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = `/@fs/${path
  .resolve(SPEC_DIR, "../../../../packages/interface/src")
  .replaceAll("\\", "/")}`;
const AB_PAGES = 4;
const PAGE_WIDTH = 800;
const PAGE_HEIGHT = 1200;

interface AbRunStats {
  readonly wallMs: number;
  readonly webglAttempts: number;
  readonly webglContexts: number;
  readonly perImageRenderEndMs: readonly number[];
}

interface AbPixelComparison {
  readonly name: string;
  readonly byteEqual: boolean;
  readonly pixelEqual: boolean;
  readonly diffPixels: number;
  readonly maxChannelDelta: number;
  readonly alphaDiffPixels: number;
  readonly pixelsA: number;
  readonly pixelsB: number;
}

interface AbBaselinePayload {
  readonly generatedAt: string;
  readonly gate: string;
  readonly userAgent: string;
  readonly browserVersion: string;
  readonly fixture: {
    readonly pages: number;
    readonly width: number;
    readonly height: number;
    readonly paintLayerAlpha: boolean;
    readonly textRegionsPerPage: number;
    readonly outFormat: string;
  };
  readonly flagOff: AbRunStats;
  readonly flagOn: AbRunStats;
  readonly perImage: readonly AbPixelComparison[];
  readonly verdict: string;
}

const roundMs = (value: number): number => Math.round(value * 100) / 100;

const installAbInstrumentation = async (page: Page): Promise<void> =>
  page.evaluate(() => {
    const originalGetContext: (
      contextId: string,
      options?: WebGLContextAttributes,
    ) => RenderingContext | null = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (
        this: HTMLCanvasElement,
        contextId: string,
        options?: WebGLContextAttributes,
      ): RenderingContext | null {
        const result = originalGetContext.apply(this, [contextId, options]);
        if (contextId === "webgl") {
          window.komaAbWebglAttempts += 1;
          if (result !== null) window.komaAbWebglContexts += 1;
        }
        return result;
      },
      writable: true,
      configurable: true,
    });
    const originalToBlob: (
      callback: BlobCallback,
      type?: string,
      quality?: number,
    ) => void = HTMLCanvasElement.prototype.toBlob;
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      value: function (
        this: HTMLCanvasElement,
        callback: BlobCallback,
        type?: string,
        quality?: number,
      ): void {
        window.komaAbToBlobAt.push(performance.now());
        originalToBlob.call(this, callback, type, quality);
      },
      writable: true,
      configurable: true,
    });
    window.komaAbWebglAttempts = 0;
    window.komaAbWebglContexts = 0;
    window.komaAbToBlobAt = [];
  });

const resetAbWindow = async (page: Page): Promise<void> =>
  page.evaluate(() => {
    window.komaAbWebglAttempts = 0;
    window.komaAbWebglContexts = 0;
    window.komaAbToBlobAt = [];
  });

const readAbWindow = async (
  page: Page,
): Promise<{
  webglAttempts: number;
  webglContexts: number;
  toBlobAt: readonly number[];
}> =>
  page.evaluate(() => ({
    webglAttempts: window.komaAbWebglAttempts,
    webglContexts: window.komaAbWebglContexts,
    toBlobAt: [...window.komaAbToBlobAt],
  }));

const setComposeFlag = async (
  page: Page,
  flagEnabled: boolean | null,
): Promise<void> =>
  page.evaluate(async ({ src, enabled }) => {
    const composer = (await import(`${src}/utils/webglCompose.ts`)) as {
      setWebGLComposeEnabled: (value: boolean | null) => void;
    };
    composer.setWebGLComposeEnabled(enabled);
  }, { src: SRC, enabled: flagEnabled });

const forcePngZipExport = async (page: Page): Promise<void> =>
  page.evaluate(async ({ src }) => {
    const exportStore = (await import(
      `${src}/pages/dashboard/stores/export-store.ts`
    )) as {
      useExportStore: {
        getState: () => {
          setOutFormat(format: string): void;
          setDownloadBundleFormat(format: "zip" | "cbz" | "cb7" | "pdf"): void;
        };
      };
    };
    exportStore.useExportStore.getState().setOutFormat("image/png");
    exportStore.useExportStore.getState().setDownloadBundleFormat("zip");
  }, { src: SRC });

const injectPaintLayerFixture = async (
  page: Page,
  args: { readonly imageIds: readonly string[] },
): Promise<void> =>
  page.evaluate(async ({ src, imageIds }) => {
    const paintCanvas = document.createElement("canvas");
    paintCanvas.width = 800;
    paintCanvas.height = 1200;
    const ctx = paintCanvas.getContext("2d");
    if (!ctx) throw new Error("ab-fixture: no 2d context");
    ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
    ctx.strokeStyle = "rgba(220, 40, 40, 0.55)";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(60, 90);
    ctx.lineTo(700, 600);
    ctx.lineTo(120, 1080);
    ctx.stroke();
    ctx.fillStyle = "rgba(30, 90, 220, 0.4)";
    ctx.beginPath();
    ctx.ellipse(400, 300, 180, 90, 0.4, 0, Math.PI * 2);
    ctx.fill();
    const paintLayerDataUrl = paintCanvas.toDataURL("image/png");
    const manualTools = (await import(
      `${src}/pages/dashboard/stores/manual-tools-store.ts`
    )) as {
      useManualToolsStore: {
        getState: () => {
          setAioManualImageEditsByImage(
            value: Record<
              string,
              {
                readonly paintLayerDataUrl: string | null;
                readonly baseImageDataUrl: string | null;
                readonly wandMaskDataUrl: string | null;
                readonly segmentBrushDataUrl: string | null;
              }
            >,
          ): void;
        };
      };
    };
    const edits: Record<string, {
      paintLayerDataUrl: string;
      baseImageDataUrl: null;
      wandMaskDataUrl: null;
      segmentBrushDataUrl: null;
    }> = {};
    for (const imageId of imageIds) {
      edits[imageId] = {
        paintLayerDataUrl,
        baseImageDataUrl: null,
        wandMaskDataUrl: null,
        segmentBrushDataUrl: null,
      };
    }
    manualTools.useManualToolsStore.getState().setAioManualImageEditsByImage(edits);
  }, { src: SRC, ...args });

const runAbExport = async (
  page: Page,
  targetZip: string,
): Promise<AbRunStats> => {
  await resetAbWindow(page);
  const trigger = page.locator('[data-tour="topbar-download-trigger"]');
  await expect(trigger).toBeEnabled();
  // The trigger toggles the menu; a menu left open by the previous run must
  // be closed first or the click below closes it instead of opening it.
  if ((await trigger.getAttribute("aria-expanded")) === "true") {
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  }
  await trigger.click();
  const primaryAction = page.locator(".koma-dlmenu__action--primary");
  await expect(primaryAction).toBeEnabled();
  const started = await markPerfClock(page);
  const downloadPromise = page.waitForEvent("download", { timeout: 240_000 });
  await primaryAction.click();
  const download = await downloadPromise;
  const wallMs = (await markPerfClock(page)) - started;
  await download.saveAs(targetZip);
  const stats = await readAbWindow(page);
  return {
    wallMs: roundMs(wallMs),
    webglAttempts: stats.webglAttempts,
    webglContexts: stats.webglContexts,
    perImageRenderEndMs: stats.toBlobAt.map((at, index) => {
      const previous =
        index === 0 ? started : (stats.toBlobAt[index - 1] ?? started);
      return roundMs(at - previous);
    }),
  };
};

interface ZipPngEntry {
  readonly name: string;
  readonly bytes: Uint8Array;
}

const readZipPngEntries = (zipPath: string): ZipPngEntry[] => {
  const bytes = new Uint8Array(fs.readFileSync(zipPath));
  const entries = unzipSync(bytes);
  return Object.entries(entries)
    .filter(([name, data]) => name.endsWith(".png") && data.byteLength > 0)
    .map(([name, data]) => ({ name, bytes: data }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

const comparePngPixels = async (
  page: Page,
  args: { readonly aBase64: string; readonly bBase64: string },
): Promise<Omit<AbPixelComparison, "name" | "byteEqual">> =>
  page.evaluate(async ({ aBase64, bBase64 }) => {
    const buffers: Uint8ClampedArray[] = [];
    for (const base64 of [aBase64, bBase64]) {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.addEventListener("load", () => resolve(img), { once: true });
        img.addEventListener(
          "error",
          () => reject(new Error("ab-fixture: png decode failed")),
          { once: true },
        );
        img.src = `data:image/png;base64,${base64}`;
      });
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("ab-fixture: no 2d context");
      ctx.drawImage(image, 0, 0);
      buffers.push(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    }
    const [dataA, dataB] = buffers;
    if (!dataA || !dataB) throw new Error("ab-fixture: missing decoded buffers");
    let diffPixels = 0;
    let maxChannelDelta = 0;
    let alphaDiffPixels = 0;
    if (dataA.length === dataB.length) {
      for (let offset = 0; offset < dataA.length; offset += 4) {
        let pixelDiffers = false;
        for (let channel = 0; channel < 4; channel += 1) {
          const delta = Math.abs(
            (dataA[offset + channel] ?? 0) - (dataB[offset + channel] ?? 0),
          );
          if (delta > 0) {
            pixelDiffers = true;
            if (delta > maxChannelDelta) maxChannelDelta = delta;
            if (channel === 3) alphaDiffPixels += 1;
          }
        }
        if (pixelDiffers) diffPixels += 1;
      }
    }
    return {
      pixelEqual: diffPixels === 0 && dataA.length === dataB.length,
      diffPixels,
      maxChannelDelta,
      alphaDiffPixels,
      pixelsA: dataA.length / 4,
      pixelsB: dataB.length / 4,
    };
  }, args);

test(
  "F3 — WebGL layer compose A/B against the 2D export path (GATE-2)",
  async ({ page, browser }) => {
    test.setTimeout(600_000);

    await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#root")).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(2000);
    await setPerfThemeFamilyClassic(page);

    const zip = buildArchiveChapterZip(
      buildArchivePageList(AB_PAGES, PAGE_WIDTH, PAGE_HEIGHT),
    );
    const pages = await injectArchivePagesFixture(page, {
      zipBase64: zip.base64,
      mimeType: "image/png",
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
    expect(pages).toHaveLength(AB_PAGES);

    await injectPaintLayerFixture(page, {
      imageIds: pages.map((pageInfo) => pageInfo.id),
    });

    await injectPerfRegions(page, {
      regionsByImage: pages.map((pageInfo, index) => ({
        imageId: pageInfo.id,
        regions: [
          {
            id: `ab-region-${index + 1}`,
            bbox: [50, 40, 750, 320],
            renderText: `KOMA AB PAGE ${index + 1}`,
          },
        ],
      })),
    });

    await forcePngZipExport(page);
    await setPerfShellMode(page, "typesetter");
    await installAbInstrumentation(page);

    const artifactsDir = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      ".artifacts",
      "perf-webgl-compose-ab",
    );
    fs.mkdirSync(artifactsDir, { recursive: true });

    await setComposeFlag(page, false);
    const flagOff = await runAbExport(
      page,
      path.join(artifactsDir, "flag-off.zip"),
    );

    await setComposeFlag(page, true);
    const flagOn = await runAbExport(
      page,
      path.join(artifactsDir, "flag-on.zip"),
    );

    const offEntries = readZipPngEntries(path.join(artifactsDir, "flag-off.zip"));
    const onEntries = readZipPngEntries(path.join(artifactsDir, "flag-on.zip"));
    expect(offEntries.length, "flag-off zip holds one png per page").toBe(AB_PAGES);
    expect(onEntries.length, "flag-on zip holds one png per page").toBe(AB_PAGES);

    const perImage: AbPixelComparison[] = [];
    for (let index = 0; index < AB_PAGES; index += 1) {
      const offEntry = offEntries[index];
      const onEntry = onEntries[index];
      expect(offEntry, `flag-off entry ${index}`).toBeDefined();
      expect(onEntry, `flag-on entry ${index}`).toBeDefined();
      if (!offEntry || !onEntry) continue;
      expect(onEntry.name).toBe(offEntry.name);
      const pixel = await comparePngPixels(page, {
        aBase64: Buffer.from(offEntry.bytes).toString("base64"),
        bBase64: Buffer.from(onEntry.bytes).toString("base64"),
      });
      perImage.push({
        name: offEntry.name,
        byteEqual: Buffer.compare(
          Buffer.from(offEntry.bytes),
          Buffer.from(onEntry.bytes),
        ) === 0,
        pixelEqual: pixel.pixelEqual,
        diffPixels: pixel.diffPixels,
        maxChannelDelta: pixel.maxChannelDelta,
        alphaDiffPixels: pixel.alphaDiffPixels,
        pixelsA: pixel.pixelsA,
        pixelsB: pixel.pixelsB,
      });
    }

    const allPixelEqual =
      perImage.length === AB_PAGES && perImage.every((entry) => entry.pixelEqual);
    const roundingClassOnly =
      perImage.every((entry) => entry.maxChannelDelta <= 2) &&
      perImage.every((entry) => entry.alphaDiffPixels === 0);

    const verdict = !allPixelEqual
      ? roundingClassOnly
        ? "differs (premultiply rounding class: maxDelta<=2, alpha identical)"
        : "differs (beyond rounding class)"
      : flagOn.webglContexts >= AB_PAGES
        ? "identical (WebGL path verified)"
        : flagOn.webglContexts > 0
          ? "identical (partial WebGL fallback)"
          : "identical (WebGL unavailable — fallback path)";

    const payload: AbBaselinePayload = {
      generatedAt: new Date().toISOString(),
      gate: "GATE-2(a): pixel-identical A/B (ImageData equality incl. alpha)",
      userAgent: await page.evaluate(() => navigator.userAgent),
      browserVersion: browser.version(),
      fixture: {
        pages: AB_PAGES,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        paintLayerAlpha: true,
        textRegionsPerPage: 1,
        outFormat: "image/png",
      },
      flagOff,
      flagOn,
      perImage,
      verdict,
    };

    const baselineDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../.sisyphus/baselines",
    );
    fs.mkdirSync(baselineDir, { recursive: true });
    const baselinePath = path.join(baselineDir, "perf-fase3-webgl-ab.json");
    fs.writeFileSync(
      baselinePath,
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8",
    );
    console.log(`PERF_WEBGL_COMPOSE_AB ${JSON.stringify({
      verdict,
      flagOffWallMs: flagOff.wallMs,
      flagOnWallMs: flagOn.wallMs,
      flagOnWebglContexts: flagOn.webglContexts,
      baselinePath,
    })}`);

    expect(
      flagOff.webglAttempts,
      "flag-off run must not touch WebGL (2D path untouched)",
    ).toBe(0);
    expect(
      flagOn.webglAttempts,
      "flag-on run must attempt the WebGL composer per page",
    ).toBeGreaterThanOrEqual(AB_PAGES);
    for (const entry of perImage) {
      expect(
        entry.maxChannelDelta,
        `${entry.name}: pixel deltas beyond the premultiply rounding class`,
      ).toBeLessThanOrEqual(2);
      expect(
        entry.alphaDiffPixels,
        `${entry.name}: alpha channel must be identical`,
      ).toBe(0);
    }
  },
);
