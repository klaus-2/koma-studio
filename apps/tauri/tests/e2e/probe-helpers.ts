import type { Page } from "@playwright/test";

// Temporary Fase-0 measurement probes (refactor-queue.md section 6) — untracked
// on purpose. Shared helpers for the GPU-mode interaction sweep and the
// text-follow drag probe.

export const GPU_ARGS = [
  "--enable-gpu",
  "--disable-software-rasterizer",
  "--enable-zero-copy",
];

// Default = HEADED (real GPU). SWEEP_HEADLESS=1 opts into the fallback:
// headless "new" (chromium channel) with the same GPU args. The specs log
// which mode actually ran (GPU_MODE line, from the UA).
export const probeLaunchOptions = (): {
  headless: boolean;
  channel: "chromium";
  args: string[];
} =>
  process.env.SWEEP_HEADLESS === "1"
    ? { headless: true, channel: "chromium", args: GPU_ARGS }
    : { headless: false, channel: "chromium", args: GPU_ARGS };

// Sidecar noise the desktop shell normally supervises (auth :3001,
// mini-backend :8000/:8001 stay offline in web e2e).
const SIDECAR_NOISE =
  /127\.0\.0\.1:(3001|8000|8001)|Failed to fetch|net::ERR_/i;

export interface ProbeProblem {
  kind: "pageerror" | "console-error" | "http-5xx";
  detail: string;
}

export const collectProblems = (page: Page): ProbeProblem[] => {
  const problems: ProbeProblem[] = [];
  page.on("pageerror", (error) => {
    problems.push({ kind: "pageerror", detail: error.message });
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (SIDECAR_NOISE.test(text)) return;
    problems.push({ kind: "console-error", detail: text });
  });
  page.on("response", (response) => {
    if (response.status() >= 500 && !SIDECAR_NOISE.test(response.url())) {
      problems.push({
        kind: "http-5xx",
        detail: `${response.status()} ${response.url()}`,
      });
    }
  });
  return problems;
};

interface LongTaskEntry {
  duration: number;
  startTime: number;
}

export const installLongTaskCollector = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const win = window as unknown as {
      __komaLongTasks?: Array<{ duration: number; startTime: number }>;
    };
    win.__komaLongTasks = [];
    try {
      const observer = new PerformanceObserver((list) => {
        const target = window as unknown as {
          __komaLongTasks?: Array<{ duration: number; startTime: number }>;
        };
        for (const entry of list.getEntries()) {
          target.__komaLongTasks?.push({
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // longtask entry type unsupported — collector stays empty.
    }
  });
};

export const markLongTasks = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const win = window as unknown as { __komaLongTasks?: LongTaskEntry[] };
    return win.__komaLongTasks?.length ?? 0;
  });

export const collectLongTasksSince = (
  page: Page,
  mark: number,
): Promise<LongTaskEntry[]> =>
  page.evaluate((from) => {
    const win = window as unknown as { __komaLongTasks?: LongTaskEntry[] };
    return (win.__komaLongTasks ?? []).slice(from);
  }, mark);

export const worstOf = (tasks: LongTaskEntry[]): number =>
  tasks.reduce((max, task) => Math.max(max, task.duration), 0);

// Logs which mode actually ran and the GPU signals visible to the page.
export const logGpuMode = async (
  page: Page,
  tag: string,
): Promise<{ mode: "headed" | "headless"; webgpu: boolean; webgl2: boolean }> => {
  const info = await page.evaluate(() => {
    const probeCanvas = document.createElement("canvas");
    return {
      ua: navigator.userAgent,
      webgpu: "gpu" in navigator,
      webgl2: Boolean(probeCanvas.getContext("webgl2")),
    };
  });
  const mode: "headed" | "headless" = /Headless/i.test(info.ua)
    ? "headless"
    : "headed";
  console.log(
    `GPU_MODE [${tag}] ${mode} webgpu=${info.webgpu} webgl2=${info.webgl2} ua=${info.ua}`,
  );
  return { mode, webgpu: info.webgpu, webgl2: info.webgl2 };
};

export interface ProbeRegionSpec {
  id: string;
  bbox: [number, number, number, number];
  renderText: string;
}

// Module-path root for the dashboard stores inside the vite module graph.
const STORES = "/@fs/C:/Github/koma/packages/interface/src/pages/dashboard/stores";

interface ProbeImagePayload {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  rotation: number;
  filters: {
    brightness: number;
    contrast: number;
    saturation: number;
    sharpen: number;
    levels: { black: number; white: number; gamma: number };
    grayscale: boolean;
    inverted: boolean;
  };
}

// Paints a 1600x1200 PNG blob on a canvas, wraps it in a File and injects it
// plus the manual regions straight into the dashboard zustand stores (same
// module instances the app uses — vite /@fs module graph).
export const injectProbeFixture = async (
  page: Page,
  regions: ProbeRegionSpec[],
): Promise<void> => {
  await page.evaluate(
    async ({ stores, regions }) => {
      const paintBlob = await new Promise<Blob>((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1600;
        canvas.height = 1200;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("probe: no 2d context"));
          return;
        }
        const gradient = ctx.createLinearGradient(0, 0, 1600, 1200);
        gradient.addColorStop(0, "#f5f0e6");
        gradient.addColorStop(1, "#d8d2c4");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1600, 1200);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("probe: toBlob failed"));
        }, "image/png");
      });
      const file = new File([paintBlob], "probe-page.png", {
        type: "image/png",
      });
      const url = URL.createObjectURL(file);

      const image: ProbeImagePayload = {
        id: "probe-image-1",
        file,
        url,
        width: 1600,
        height: 1200,
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

      const collectionModule = (await import(
        `${stores}/image-collection-store.ts`
      )) as {
        useImageCollectionStore: {
          getState: () => {
            addImages: (images: ProbeImagePayload[]) => void;
            setActiveId: (id: string) => void;
          };
        };
      };
      collectionModule.useImageCollectionStore.getState().addImages([image]);
      collectionModule.useImageCollectionStore.getState().setActiveId("probe-image-1");

      const regionModule = (await import(
        `${stores}/region-editor-store.ts`
      )) as {
        useRegionEditorStore: {
          getState: () => {
            setAioDetectionsByImage: (value: unknown) => void;
          };
        };
      };
      const detections = regions.map((region) => ({
        ...region,
        score: 1,
        source: "manual",
        modelKey: "probe",
      }));
      regionModule.useRegionEditorStore
        .getState()
        .setAioDetectionsByImage({ "probe-image-1": detections });
    },
    { stores: STORES, regions },
  );
};

export const setShellMode = async (
  page: Page,
  mode: string,
): Promise<void> => {
  await page.evaluate(async ({ stores, mode }) => {
    const shellModule = (await import(`${stores}/ui-shell-store.ts`)) as {
      useUiShellStore: {
        getState: () => {
          setMode: (next: string) => void;
          setSubMode: (next: string) => void;
        };
      };
    };
    shellModule.useUiShellStore.getState().setMode(mode);
    shellModule.useUiShellStore.getState().setSubMode("manual");
  }, { stores: STORES, mode });
};

// Fast-forwards the per-image manual pipeline progress to the render stage
// (index 5 of AIO_MANUAL_STAGE_ORDER). Without this, a fresh image sits at
// detectText (1/6) and the AIO stage renders the detection preview instead of
// the RenderTextPreview stage that owns .koma-render-box + .koma-render-canvas.
// statusByStage is read with ?? fallbacks everywhere, so a sparse record is fine.
export const setProbeManualStageAtRender = async (page: Page): Promise<void> => {
  await page.evaluate(async ({ stores }) => {
    const pipelineModule = (await import(
      `${stores}/aio-pipeline-store.ts`
    )) as {
      useAioPipelineStore: {
        getState: () => {
          setAioManualProgressByImage: (value: unknown) => void;
        };
      };
    };
    pipelineModule.useAioPipelineStore.getState().setAioManualProgressByImage({
      "probe-image-1": {
        currentIndex: 5,
        unlockedMaxIndex: 5,
        statusByStage: {},
      },
    });
  }, { stores: STORES });
};

export const selectProbeRegion = async (
  page: Page,
  regionId: string,
): Promise<void> => {
  await page.evaluate(async ({ stores, regionId }) => {
    const regionModule = (await import(`${stores}/region-editor-store.ts`)) as {
      useRegionEditorStore: {
        getState: () => {
          setAioSelectedRegionByImage: (value: unknown) => void;
        };
      };
    };
    regionModule.useRegionEditorStore
      .getState()
      .setAioSelectedRegionByImage({ "probe-image-1": regionId });
  }, { stores: STORES, regionId });
};

// Alpha-pixel mass (opaque pixel count) of a canvas window — the "text moved"
// signal. Returns -1 when sampling is disabled (__komaNoPixels) or the canvas
// is missing.
export const sampleCanvasMass = (
  page: Page,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<number> =>
  page.evaluate(({ x, y, w, h }) => {
    const win = window as unknown as { __komaNoPixels?: boolean };
    if (win.__komaNoPixels) return -1;
    const canvas = document.querySelector<HTMLCanvasElement>(
      "canvas.koma-render-canvas",
    );
    if (!canvas) return -1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return -1;
    const data = ctx.getImageData(x, y, w, h).data;
    let mass = 0;
    for (let i = 3; i < data.length; i += 4) {
      if ((data[i] ?? 0) > 0) mass += 1;
    }
    return mass;
  }, { x, y, w, h });
