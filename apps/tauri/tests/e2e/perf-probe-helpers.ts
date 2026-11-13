import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { zipSync } from "fflate";

const buildGradientPngBytes = (width: number, height: number): Uint8Array => {
  const png = new PNG({ width, height });
  const row = Buffer.alloc(width * 4);
  for (let x = 0; x < width; x += 1) {
    const idx = x * 4;
    const shade = Math.round((x * 255) / Math.max(1, width - 1));
    row[idx] = shade;
    row[idx + 1] = 255 - shade;
    row[idx + 2] = Math.round(shade / 2);
    row[idx + 3] = 255;
  }
  for (let y = 0; y < height; y += 1) {
    png.data.set(row, y * width * 4);
  }
  return new Uint8Array(PNG.sync.write(png));
};

export interface ArchiveFixturePage {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

export interface ArchiveFixtureZip {
  readonly bytes: Uint8Array;
  readonly base64: string;
  readonly pageNames: readonly string[];
}

export const buildArchiveChapterZip = (
  pages: readonly ArchiveFixturePage[],
): ArchiveFixtureZip => {
  const files: Record<string, Uint8Array> = {};
  for (const page of pages) {
    files[page.name] = buildGradientPngBytes(page.width, page.height);
  }
  const bytes = zipSync(files, { level: 0 });
  return {
    bytes,
    base64: Buffer.from(bytes).toString("base64"),
    pageNames: pages.map((page) => page.name),
  };
};

export const buildArchivePageList = (
  count: number,
  width: number,
  height: number,
): ArchiveFixturePage[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `page-${String(index + 1).padStart(3, "0")}.png`,
    width,
    height,
  }));

export interface InjectedPageInfo {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

export interface PerfRegionSpec {
  readonly id: string;
  readonly bbox: [number, number, number, number];
  readonly renderText: string;
}

interface ProbeArchiveEntryMeta {
  readonly path: string;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly method: number;
}

interface ProbeArchiveChapter {
  readonly id: string;
  readonly label: string;
  readonly archive: File;
  readonly entries: readonly ProbeArchiveEntryMeta[];
}

interface ProbePageFile {
  readonly kind: "direct" | "archive";
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified: number;
  toBlob(): Promise<Blob>;
  dimensions(): Promise<{ width: number; height: number }>;
  release(): void;
}

interface ProbePageSourceModule {
  createDirectPageFile(file: File): ProbePageFile;
  createArchivePageFile(
    chapter: ProbeArchiveChapter,
    entry: ProbeArchiveEntryMeta,
    fileName: string,
    mimeType: string,
  ): ProbePageFile;
}

interface ProbeArchiveReaderModule {
  openArchiveChapter(
    archive: File,
  ): Promise<{ chapter: ProbeArchiveChapter; warnings: string[] }>;
}

interface ProbeLoadedImage {
  readonly id: string;
  readonly file: ProbePageFile;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly filters: {
    readonly brightness: number;
    readonly contrast: number;
    readonly saturation: number;
    readonly sharpen: number;
    readonly levels: { readonly black: number; readonly white: number; readonly gamma: number };
    readonly grayscale: boolean;
    readonly inverted: boolean;
  };
  readonly chapterId?: string;
  readonly chapterLabel?: string;
}

interface ProbeRegion {
  readonly id: string;
  readonly bbox: readonly [number, number, number, number];
  readonly score: number;
  readonly source: string;
  readonly modelKey: string;
  readonly renderText: string;
}

const SRC = "/@fs/C:/Github/koma-studio/packages/interface/src";
const UI_SRC = "/@fs/C:/Github/koma-studio/packages/ui/src";

interface InjectArchiveArgs {
  readonly zipBase64: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
  readonly residentUrls?: boolean;
}

export const injectArchivePagesFixture = async (
  page: Page,
  args: InjectArchiveArgs,
): Promise<InjectedPageInfo[]> =>
  page.evaluate(async ({ src, zipBase64, mimeType, width, height, residentUrls = true }: {
    src: string;
    zipBase64: string;
    mimeType: string;
    width: number;
    height: number;
    residentUrls?: boolean;
  }) => {
    const binary = Uint8Array.from(atob(zipBase64), (char) =>
      char.charCodeAt(0),
    );
    const archiveFile = new File([binary], "perf-fixture.cbz", {
      type: "application/zip",
    });
    const reader = (await import(
      `${src}/utils/archive-chapter-reader.ts`
    )) as ProbeArchiveReaderModule;
    const pageSource = (await import(
      `${src}/utils/page-source.ts`
    )) as ProbePageSourceModule;
    const { chapter } = await reader.openArchiveChapter(archiveFile);
    const images: ProbeLoadedImage[] = [];
    for (const entry of chapter.entries) {
      const pageFile = pageSource.createArchivePageFile(
        chapter,
        entry,
        entry.path,
        mimeType,
      );
      const url = residentUrls ? URL.createObjectURL(await pageFile.toBlob()) : '';
      images.push({
        id: crypto.randomUUID(),
        file: pageFile,
        url,
        width,
        height,
        rotation: 0,
          filters: {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          sharpen: 0,
          levels: { black: 0, white: 255, gamma: 1 },
          grayscale: false,
          inverted: false,
        },
        chapterId: chapter.id,
        chapterLabel: chapter.label,
      });
    }
    const collection = (await import(
      `${src}/pages/dashboard/stores/image-collection-store.ts`
    )) as {
      useImageCollectionStore: {
        getState: () => {
          addImages(newImages: readonly ProbeLoadedImage[]): void;
          setActiveId(activeId: string | null): void;
        };
      };
    };
    collection.useImageCollectionStore.getState().addImages(images);
    collection.useImageCollectionStore
      .getState()
      .setActiveId(images[0]?.id ?? null);
    return images.map((image) => ({
      id: image.id,
      name: image.file.name,
      width: image.width,
      height: image.height,
    }));
  }, { src: SRC, ...args });

interface InjectTallPageArgs {
  readonly width: number;
  readonly height: number;
}

export const injectTallPageFixture = async (
  page: Page,
  args: InjectTallPageArgs,
): Promise<InjectedPageInfo> =>
  page.evaluate(async ({ src, width, height }) => {
    const paintBlob = await new Promise<Blob>((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("perf probe: no 2d context"));
        return;
      }
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#f5f0e6");
      gradient.addColorStop(1, "#d8d2c4");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("perf probe: toBlob failed"));
      }, "image/png");
    });
    const file = new File([paintBlob], "perf-strip-page.png", {
      type: "image/png",
    });
    const pageSource = (await import(
      `${src}/utils/page-source.ts`
    )) as ProbePageSourceModule;
    const directFile = pageSource.createDirectPageFile(file);
    const image: ProbeLoadedImage = {
      id: crypto.randomUUID(),
      file: directFile,
      url: URL.createObjectURL(file),
      width,
      height,
      rotation: 0,
        filters: {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          sharpen: 0,
          levels: { black: 0, white: 255, gamma: 1 },
          grayscale: false,
          inverted: false,
        },
    };
    const collection = (await import(
      `${src}/pages/dashboard/stores/image-collection-store.ts`
    )) as {
      useImageCollectionStore: {
        getState: () => {
          addImages(newImages: readonly ProbeLoadedImage[]): void;
          setActiveId(activeId: string | null): void;
        };
      };
    };
    collection.useImageCollectionStore.getState().addImages([image]);
    collection.useImageCollectionStore.getState().setActiveId(image.id);
    return {
      id: image.id,
      name: image.file.name,
      width: image.width,
      height: image.height,
    };
  }, { src: SRC, ...args });

interface InjectRegionsArgs {
  readonly regionsByImage: readonly {
    readonly imageId: string;
    readonly regions: readonly PerfRegionSpec[];
  }[];
}

export const injectPerfRegions = async (
  page: Page,
  args: InjectRegionsArgs,
): Promise<void> =>
  page.evaluate(async ({ src, regionsByImage }) => {
    const regions = (await import(
      `${src}/pages/dashboard/stores/region-editor-store.ts`
    )) as {
      useRegionEditorStore: {
        getState: () => {
          setAioDetectionsByImage(
            value: Record<string, readonly ProbeRegion[]>,
          ): void;
        };
      };
    };
    const detections: Record<string, readonly ProbeRegion[]> = {};
    for (const entry of regionsByImage) {
      detections[entry.imageId] = entry.regions.map(
        (region): ProbeRegion => ({
          id: region.id,
          bbox: region.bbox,
          score: 1,
          source: "manual",
          modelKey: "perf-probe",
          renderText: region.renderText,
        }),
      );
    }
    regions.useRegionEditorStore.getState().setAioDetectionsByImage(detections);
  }, { src: SRC, ...args });

export const setPerfShellMode = async (
  page: Page,
  mode: string,
): Promise<void> =>
  page.evaluate(async ({ src, mode: nextMode }) => {
    const shell = (await import(
      `${src}/pages/dashboard/stores/ui-shell-store.ts`
    )) as {
      useUiShellStore: {
        getState: () => {
          setMode(nextMode: string): void;
          setSubMode(subMode: string): void;
        };
      };
    };
    shell.useUiShellStore.getState().setMode(nextMode);
    shell.useUiShellStore.getState().setSubMode("manual");
  }, { src: SRC, mode });

export const setPerfAioManualStageAtRender = async (
  page: Page,
  imageId: string,
): Promise<void> =>
  page.evaluate(async ({ src, imageId: targetImageId }) => {
    const pipeline = (await import(
      `${src}/pages/dashboard/stores/aio-pipeline-store.ts`
    )) as {
      useAioPipelineStore: {
        getState: () => {
          setAioManualProgressByImage(value: {
            readonly [imageId: string]: {
              readonly currentIndex: number;
              readonly unlockedMaxIndex: number;
              readonly statusByStage: Record<string, never>;
            };
          }): void;
        };
      };
    };
    pipeline.useAioPipelineStore.getState().setAioManualProgressByImage({
      [targetImageId]: {
        currentIndex: 5,
        unlockedMaxIndex: 5,
        statusByStage: {},
      },
    });
  }, { src: SRC, imageId });

export const setPerfThemeFamilyClassic = async (page: Page): Promise<void> =>
  page.evaluate(async ({ uiSrc }) => {
    const theme = (await import(`${uiSrc}/stores/theme-store.ts`)) as {
      useThemeStore: {
        getState: () => {
          setFamily(family: "classic" | "noir"): void;
        };
      };
    };
    theme.useThemeStore.getState().setFamily("classic");
  }, { uiSrc: UI_SRC });

export const installPerfCollectors = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.__komaPerfLongTasks = [];
    window.__komaPerfFrames = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__komaPerfLongTasks?.push({
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
    }
    const originalRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
      originalRaf((timestamp: number) => {
        const start = performance.now();
        try {
          callback(timestamp);
        } finally {
          window.__komaPerfFrames?.push({
            start,
            duration: performance.now() - start,
          });
        }
      });
  });
};

export const markPerfClock = (page: Page): Promise<number> =>
  page.evaluate(() => performance.now());

export interface PerfLongTaskWindow {
  readonly count: number;
  readonly totalMs: number;
  readonly blockedMs: number;
  readonly worstMs: number;
}

export const readLongTaskWindow = (
  page: Page,
  since: number,
): Promise<PerfLongTaskWindow> =>
  page.evaluate((from) => {
    const tasks = (window.__komaPerfLongTasks ?? []).filter(
      (task) => task.startTime >= from,
    );
    const totalMs = tasks.reduce((sum, task) => sum + task.duration, 0);
    const blockedMs = tasks.reduce(
      (sum, task) => sum + Math.max(0, task.duration - 50),
      0,
    );
    const worstMs = tasks.reduce(
      (max, task) => Math.max(max, task.duration),
      0,
    );
    return { count: tasks.length, totalMs, blockedMs, worstMs };
  }, since);

export interface PerfFrameWindow {
  readonly count: number;
  readonly callbackMeanMs: number;
  readonly callbackP50Ms: number;
  readonly callbackP95Ms: number;
  readonly callbackMaxMs: number;
  readonly gapMeanMs: number;
  readonly gapP95Ms: number;
  readonly gapMaxMs: number;
}

const emptyFrameWindow: PerfFrameWindow = {
  count: 0,
  callbackMeanMs: 0,
  callbackP50Ms: 0,
  callbackP95Ms: 0,
  callbackMaxMs: 0,
  gapMeanMs: 0,
  gapP95Ms: 0,
  gapMaxMs: 0,
};

export const readFrameWindow = (
  page: Page,
  since: number,
): Promise<PerfFrameWindow> =>
  page.evaluate((from) => {
    const frames = (window.__komaPerfFrames ?? []).filter(
      (frame) => frame.start >= from,
    );
    if (frames.length === 0) return null;
    const durations = frames
      .map((frame) => frame.duration)
      .sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let index = 1; index < frames.length; index += 1) {
      const previous = frames[index - 1];
      const current = frames[index];
      if (previous && current) gaps.push(current.start - previous.start);
    }
    gaps.sort((a, b) => a - b);
    const percentile = (sorted: readonly number[], ratio: number): number => {
      if (sorted.length === 0) return 0;
      const position = Math.min(
        sorted.length - 1,
        Math.floor(ratio * (sorted.length - 1) + 0.5),
      );
      return sorted[position] ?? 0;
    };
    const mean = (sorted: readonly number[]): number =>
      sorted.length === 0
        ? 0
        : sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    return {
      count: frames.length,
      callbackMeanMs: mean(durations),
      callbackP50Ms: percentile(durations, 0.5),
      callbackP95Ms: percentile(durations, 0.95),
      callbackMaxMs: durations[durations.length - 1] ?? 0,
      gapMeanMs: mean(gaps),
      gapP95Ms: percentile(gaps, 0.95),
      gapMaxMs: gaps[gaps.length - 1] ?? 0,
    };
  }, since).then((stats) => stats ?? emptyFrameWindow);

export interface CanvasCensusEntry {
  readonly className: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

export const readCanvasCensus = (
  page: Page,
): Promise<CanvasCensusEntry[]> =>
  page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll("canvas"));
    return canvases.map((canvas) => ({
      className: canvas.className,
      width: canvas.width,
      height: canvas.height,
      bytes: canvas.width * canvas.height * 4,
    }));
  });

export const readOverlayBoxCount = (page: Page): Promise<number> =>
  page.evaluate(
    () => document.querySelectorAll(".koma-render-box").length,
  );

export interface SidebarScrollResult {
  readonly frames: number;
  readonly elapsedMs: number;
  readonly fps: number;
  readonly gapMeanMs: number;
  readonly gapP95Ms: number;
  readonly gapMaxMs: number;
}

export const runSidebarScrollProbe = (
  page: Page,
  args: { readonly deltaPerFrame: number; readonly maxFrames: number },
): Promise<SidebarScrollResult> =>
  page.evaluate(({ deltaPerFrame, maxFrames }) => {
    const list = document.querySelector<HTMLElement>(".koma-files__list");
    if (!list) {
      return {
        frames: 0,
        elapsedMs: 0,
        fps: 0,
        gapMeanMs: 0,
        gapP95Ms: 0,
        gapMaxMs: 0,
      };
    }
    return new Promise<SidebarScrollResult>((resolve) => {
      const start = performance.now();
      let frames = 0;
      let last = start;
      const gaps: number[] = [];
      const step = (): void => {
        const now = performance.now();
        gaps.push(now - last);
        last = now;
        frames += 1;
        list.scrollTop += deltaPerFrame;
        if (
          frames >= maxFrames ||
          list.scrollTop + list.clientHeight >= list.scrollHeight
        ) {
          const sorted = [...gaps].sort((a, b) => a - b);
          const percentile = (ratio: number): number => {
            if (sorted.length === 0) return 0;
            const position = Math.min(
              sorted.length - 1,
              Math.floor(ratio * (sorted.length - 1) + 0.5),
            );
            return sorted[position] ?? 0;
          };
          const elapsedMs = performance.now() - start;
          const gapMeanMs =
            gaps.length === 0
              ? 0
              : gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
          resolve({
            frames,
            elapsedMs,
            fps: elapsedMs > 0 ? (frames / elapsedMs) * 1000 : 0,
            gapMeanMs,
            gapP95Ms: percentile(0.95),
            gapMaxMs: sorted[sorted.length - 1] ?? 0,
          });
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, args);

export interface SidebarDecodeCounts {
  readonly sidebarImgCount: number;
  readonly fullPageDecodes: number;
  readonly thumbnailDecodes: number;
}

export const readSidebarDecodeCounts = (
  page: Page,
  fullPageWidth: number,
): Promise<SidebarDecodeCounts> =>
  page.evaluate((fullWidth) => {
    const thumbs = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        '.koma-files__list img[alt="thumb"]',
      ),
    );
    const loaded = thumbs.filter(
      (img) => img.complete && img.naturalWidth > 0,
    );
    return {
      sidebarImgCount: thumbs.length,
      fullPageDecodes: loaded.filter((img) => img.naturalWidth >= fullWidth)
        .length,
      thumbnailDecodes: loaded.filter(
        (img) => img.naturalWidth > 0 && img.naturalWidth < fullWidth,
      ).length,
    };
  }, fullPageWidth);

export const readSidebarDomNodeCount = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      document.querySelectorAll('[data-tour="dashboard-sidebar"] *').length,
  );

const PROBE_OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "probe-out",
);

export const writeProbeJson = (
  fileName: string,
  payload: Record<string, unknown>,
): string => {
  fs.mkdirSync(PROBE_OUT_DIR, { recursive: true });
  const target = path.join(PROBE_OUT_DIR, fileName);
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
};
