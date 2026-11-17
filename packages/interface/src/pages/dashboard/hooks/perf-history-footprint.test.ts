import { describe, expect, it } from 'vitest';

import { buildWorkspaceCaptureState } from './workspace-persistence.registry';
import {
  buildWorkspaceAutosaveSignature,
  buildWorkspaceHistorySignature,
  captureWorkspaceHistorySnapshot,
  releaseWorkspaceHistorySnapshot,
  type DashboardWorkspaceHistorySnapshot,
} from '../../../workspace/dashboardWorkspace';
import { runWorkspaceSerialization } from '../../../workspace/workspaceSerializerJob';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useTypographerStore } from '../stores/typographer-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useExportStore } from '../stores/export-store';
import { createDirectPageFile, type PageFile } from '../../../utils/page-source';
import type { LoadedImage } from '../../../types/dashboard.types';
import type {
  AioManualImageEditState,
  AioTextRegion,
  DownloadItem,
} from '../../../types/dashboard.types';
import type {
  TypographyBounds,
  TypographerSnapshot,
  TypographySession,
} from '../../../typography/types';

if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (): void => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
          return;
        }
        reject(new Error('Failed to read the blob as an ArrayBuffer.'));
      };
      reader.onerror = (): void => {
        reject(reader.error ?? new Error('Failed to read the blob.'));
      };
      reader.readAsArrayBuffer(this);
    });
  };
}

if (typeof URL.createObjectURL !== 'function') {
  let mockObjectUrlCounter = 0;
  URL.createObjectURL = (): string => {
    mockObjectUrlCounter += 1;
    return `blob:mock-object-url-${mockObjectUrlCounter}`;
  };
}

const PAGE_COUNT = 10;
const REGIONS_PER_PAGE = 12;
const PAINT_LAYER_CHARS = 40_000;
const PAINT_LAYER_PAGE_INDEXES = [0, 1];
const PNG_BYTES = [137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4];
const DOWNLOAD_BYTES = [10, 20, 30, 40, 50, 60, 70, 80];
const HISTORY_DEPTHS = [10, 50, 100] as const;
const WARMUP_ITERATIONS = 3;

const makePageFile = (name: string): PageFile =>
  createDirectPageFile(
    new File([new Uint8Array(PNG_BYTES)], name, {
      type: 'image/png',
      lastModified: 1_700_000_000_000,
    }),
  );

const REGION_TEXT = 'KOMA PERF HISTORY REGION RENDER TEXT SAMPLE 0123456789';

const buildRegion = (
  imageIndex: number,
  regionIndex: number,
): AioTextRegion => {
  const top = 40 + regionIndex * 90;
  const bbox: TypographyBounds = [40, top, 740, top + 80];
  return {
    id: `perf-region-${imageIndex + 1}-${regionIndex + 1}`,
    bbox,
    score: 1,
    source: 'model',
    modelKey: 'perf-probe',
    renderText: `${REGION_TEXT} #${imageIndex + 1}/${regionIndex + 1}`,
  };
};

const buildTypographerSession = (imageIndex: number): TypographySession => {
  const regions: TypographerSnapshot['regions'] = Array.from(
    { length: 8 },
    (_, regionIndex) => {
      const top = 40 + regionIndex * 90;
      const bbox: TypographyBounds = [40, top, 740, top + 80];
      return {
        id: `perf-type-region-${imageIndex + 1}-${regionIndex + 1}`,
        bbox,
        score: 1,
        source: 'manual',
        modelKey: 'perf-probe',
        renderText: `${REGION_TEXT} #${imageIndex + 1}/${regionIndex + 1}`,
      } satisfies TypographerSnapshot['regions'][number];
    },
  );
  const snapshot: TypographerSnapshot = {
    id: `perf-type-snapshot-${imageIndex + 1}`,
    name: `perf snapshot ${imageIndex + 1}`,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    selectedRegionId: regions[0]?.id ?? null,
    activePresetId: null,
    queue: [
      {
        id: `perf-queue-${imageIndex + 1}`,
        text: `Queue line for page ${imageIndex + 1}`,
        status: 'pending',
        createdAt: 1_700_000_000_000,
      },
    ],
    draftText: '',
    multiBubbleEnabled: false,
    defaults: {
      padding: 8,
      defaultShapeKind: 'rounded',
      autoDetectOnNewSelection: true,
    },
    regions,
  };
  return {
    imageId: `perf-image-${imageIndex + 1}`,
    imageFingerprint: `perf-fingerprint-${imageIndex + 1}`,
    sourceType: 'aio-handoff',
    activePresetId: null,
    selectedRegionId: regions[0]?.id ?? null,
    queue: [
      {
        id: `perf-queue-${imageIndex + 1}`,
        text: `Queue line for page ${imageIndex + 1}`,
        status: 'pending',
        createdAt: 1_700_000_000_000,
      },
    ],
    draftText: '',
    multiBubbleEnabled: false,
    defaults: {
      padding: 8,
      defaultShapeKind: 'rounded',
      autoDetectOnNewSelection: true,
    },
    snapshots: [snapshot],
    updatedAt: 1_700_000_000_000,
  };
};

const makePaintLayerDataUrl = (): string =>
  `data:image/png;base64,${'cGVyZnByb2Jl'.repeat(Math.ceil(PAINT_LAYER_CHARS / 12)).slice(0, PAINT_LAYER_CHARS)}`;

const seedWorkspaceStores = (): void => {
  const images: LoadedImage[] = Array.from(
    { length: PAGE_COUNT },
    (_, index) => {
      const file = makePageFile(`perf-history-page-${index + 1}.png`);
      const image: LoadedImage = {
        id: `perf-image-${index + 1}`,
        file,
        url: URL.createObjectURL(new Blob([])),
        width: 800,
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
      return image;
    },
  );
  useImageCollectionStore.getState().addImages(images);
  useImageCollectionStore.getState().setActiveId(images[0]?.id ?? null);

  const detections: Record<string, AioTextRegion[]> = {};
  for (const image of images) {
    detections[image.id] = Array.from({ length: REGIONS_PER_PAGE }, (_, regionIndex) =>
      buildRegion(Number(image.id.replace('perf-image-', '')) - 1, regionIndex),
    );
  }
  useRegionEditorStore.getState().setAioDetectionsByImage(detections);

  const sessions: Record<string, TypographySession> = {};
  for (const image of images) {
    sessions[image.id] = buildTypographerSession(
      Number(image.id.replace('perf-image-', '')) - 1,
    );
  }
  useTypographerStore.getState().setTypographerSessionsByImage(sessions);

  const manualEdits: Record<string, AioManualImageEditState> = {};
  const paintLayer = makePaintLayerDataUrl();
  for (const pageIndex of PAINT_LAYER_PAGE_INDEXES) {
    const imageId = `perf-image-${pageIndex + 1}`;
    manualEdits[imageId] = {
      paintLayerDataUrl: paintLayer,
      baseImageDataUrl: null,
      wandMaskDataUrl: null,
      segmentBrushDataUrl: null,
    };
  }
  useManualToolsStore.getState().setAioManualImageEditsByImage(manualEdits);

  const downloadItems: DownloadItem[] = images.slice(0, 2).map((image, index) => ({
    name: `perf-download-${index + 1}.png`,
    blob: new Blob([new Uint8Array(DOWNLOAD_BYTES)], { type: 'image/png' }),
    scope: 'typesetter',
    sourceImageId: image.id,
    previewUrl: '',
  }));
  useExportStore.getState().setDownloadItems(downloadItems);
};

const clearWorkspaceStores = (): void => {
  useImageCollectionStore.setState({ images: [], activeId: null });
  useRegionEditorStore.setState({
    aioDetectionsByImage: {},
    aioSelectedRegionByImage: {},
  });
  useTypographerStore.setState({ typographerSessionsByImage: {} });
  useManualToolsStore.setState({ aioManualImageEditsByImage: {} });
  useExportStore.setState({ downloadItems: [] });
};

const measureSnapshotPayloadBytes = (
  snapshot: DashboardWorkspaceHistorySnapshot,
): number =>
  JSON.stringify(snapshot, (_key, value: JSONValue) => {
    if (value instanceof Blob || value instanceof File) {
      return { __binaryBytes: value.size };
    }
    return value;
  }).length;

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue }
  | Blob
  | File;

interface DepthSample {
  readonly depth: number;
  readonly captureMeanMs: number;
  readonly snapshotMeanMs: number;
  readonly signatureMeanMs: number;
  readonly tickMeanMs: number;
  readonly serializeFallbackMeanMs: number;
  readonly retainedMB: number;
}

const runDepthSample = async (depth: number): Promise<DepthSample> => {
  const captureTimes: number[] = [];
  const snapshotTimes: number[] = [];
  const signatureTimes: number[] = [];
  const serializeFallbackTimes: number[] = [];
  const retained: DashboardWorkspaceHistorySnapshot[] = [];

  for (let iteration = 0; iteration < depth + WARMUP_ITERATIONS; iteration += 1) {
    const warmup = iteration < WARMUP_ITERATIONS;
    const captureStart = performance.now();
    const captureState = buildWorkspaceCaptureState(null);
    const captureEnd = performance.now();
    const snapshot = captureWorkspaceHistorySnapshot(captureState);
    const snapshotEnd = performance.now();
    const signature = buildWorkspaceHistorySignature(captureState);
    const signatureEnd = performance.now();
    // Serializer-bridge fallback reference: capture + both save-time signatures
    // on the main thread (jsdom has no Worker, so the bridge always degrades).
    const serializeStart = performance.now();
    const serialized = await runWorkspaceSerialization(captureState);
    const serializeEnd = performance.now();

    if (!warmup) {
      captureTimes.push(captureEnd - captureStart);
      snapshotTimes.push(snapshotEnd - captureEnd);
      signatureTimes.push(signatureEnd - snapshotEnd);
      serializeFallbackTimes.push(serializeEnd - serializeStart);
      retained.push(snapshot);
    } else {
      releaseWorkspaceHistorySnapshot(snapshot);
    }
    expect(signature.length).toBeGreaterThan(0);
    expect(serialized.autosaveSignature).toBe(buildWorkspaceAutosaveSignature(captureState));
    expect(serialized.historySignature).toBe(buildWorkspaceHistorySignature(captureState));
  }

  const retainedBytes = retained.reduce(
    (sum, snapshot) => sum + measureSnapshotPayloadBytes(snapshot),
    0,
  );
  for (const snapshot of retained) {
    releaseWorkspaceHistorySnapshot(snapshot);
  }

  const mean = (times: readonly number[]): number =>
    times.reduce((sum, value) => sum + value, 0) / Math.max(1, times.length);
  const captureMeanMs = mean(captureTimes);
  const snapshotMeanMs = mean(snapshotTimes);
  const signatureMeanMs = mean(signatureTimes);
  return {
    depth,
    captureMeanMs,
    snapshotMeanMs,
    signatureMeanMs,
    tickMeanMs: captureMeanMs + signatureMeanMs,
    serializeFallbackMeanMs: mean(serializeFallbackTimes),
    retainedMB:
      Math.round((retainedBytes / (1024 * 1024)) * 100) / 100,
  };
};

describe('perf-history-footprint (F3 probe, plan T1)', () => {
  it('measures capture/snapshot/serialize tick cost and retained MB per history depth', async () => {
    seedWorkspaceStores();
    try {
      const samples: DepthSample[] = [];
      for (const depth of HISTORY_DEPTHS) {
        samples.push(await runDepthSample(depth));
      }
      console.log(`PERF_HISTORY_FOOTPRINT ${JSON.stringify({ samples })}`);
      // Serializer-worker A/B reference (Task 6 assembles the JSON from this
      // output): main-thread cost of the shared serialization sequence.
      console.log(`PERF_WORKSPACE_SERIALIZE ${JSON.stringify({
        fixture: {
          pages: PAGE_COUNT,
          regionsPerPage: REGIONS_PER_PAGE,
          paintLayerChars: PAINT_LAYER_CHARS,
        },
        samples,
      })}`);

      for (const sample of samples) {
        expect(sample.retainedMB, `retained MB at depth ${sample.depth}`).toBeGreaterThan(0);
        expect(sample.captureMeanMs).toBeGreaterThan(0);
        expect(sample.snapshotMeanMs).toBeGreaterThan(0);
        expect(sample.signatureMeanMs).toBeGreaterThanOrEqual(0);
        expect(sample.retainedMB).toBeGreaterThanOrEqual(0);
      }
      const perEntryAt50 = samples[1]?.retainedMB ?? 0;
      const perEntryAt100 = samples[2]?.retainedMB ?? 0;
      expect(perEntryAt100, 'per-entry payload stays roughly constant').toBeLessThan(
        perEntryAt50 * 2.5,
      );
    } finally {
      clearWorkspaceStores();
    }
  }, 30_000);
});
