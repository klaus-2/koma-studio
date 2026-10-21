import { describe, expect, it } from 'vitest';
import {
  captureWorkspaceHistorySnapshot,
  releaseWorkspaceHistorySnapshot,
  restoreWorkspaceHistorySnapshot,
} from './dashboardWorkspace.history';
import type {
  DashboardWorkspaceCaptureState,
  DashboardWorkspaceHistorySnapshot,
} from './dashboardWorkspace';
import type {
  AioManualImageEditState,
  DownloadItem,
  ImageFilters,
  LoadedImage,
} from '../types/dashboard.types';
import type { WorkspaceManualImageEditDocument } from '../../../../packages/types/src/workspace';
import type { TypographySession } from '../typography/types';

// jsdom lacks Blob.prototype.arrayBuffer (lib.dom declares it; this runtime
// does not ship it). The round trip reads binaries through arrayBuffer();
// polyfill it via FileReader when the platform does not provide it.
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

// jsdom may lack URL.createObjectURL depending on the runtime wiring; the
// history restore path allocates object URLs for images/downloads/results.
if (typeof URL.createObjectURL !== 'function') {
  let mockObjectUrlCounter = 0;
  URL.createObjectURL = (): string => {
    mockObjectUrlCounter += 1;
    return `blob:mock-object-url-${mockObjectUrlCounter}`;
  };
}

// noUncheckedIndexedAccess makes every indexed read `T | undefined`; the
// harness asserts on the resolved payloads, so require presence explicitly.
const requireValue = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`Expected ${label} to be present.`);
  }
  return value;
};

const DATA_URL_PNG_HEADER = 'data:image/png;base64,iVBORw0KGgo=';
const DATA_URL_TEXT = 'data:image/png;base64,aGVsbG8=';
const DATA_URL_SEGMENT_BRUSH = 'data:image/png;base64,QUJDREVG';

const IMAGE_BYTES = [137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4];
const DOWNLOAD_BYTES = [10, 20, 30, 40, 50];
const AIO_DOWNLOAD_BYTES = [100, 101, 102];
const WATERMARK_BYTES = [200, 201, 202];
const OPTIMIZER_BYTES = [250, 251, 252];

const makeWorkspaceFile = (name: string): File =>
  new File([new Uint8Array(IMAGE_BYTES)], name, {
    type: 'image/png',
    lastModified: 1700000000000,
  });

const makeBlob = (bytes: number[]): Blob =>
  new Blob([new Uint8Array(bytes)], { type: 'image/png' });

const makeFilters = (): ImageFilters => ({
  brightness: 1.05,
  contrast: 1.1,
  saturation: 0.95,
  sharpen: 0.2,
  levels: { black: 0, white: 255, gamma: 1 },
  grayscale: false,
  inverted: false,
});

const makeTypesetterSession = (): TypographySession => ({
  imageId: 'img-1',
  imageFingerprint: 'fingerprint-1',
  sourceType: 'uploaded-cleaned',
  activePresetId: null,
  selectedRegionId: null,
  queue: [
    {
      id: 'q-1',
      text: 'Hello',
      status: 'pending',
      appliedRegionId: null,
      createdAt: 1700000000000,
    },
  ],
  draftText: 'Hello',
  multiBubbleEnabled: false,
  defaults: {
    padding: 8,
    defaultShapeKind: 'square',
    autoDetectOnNewSelection: true,
  },
  snapshots: [],
  updatedAt: 1700000000000,
});

const buildCaptureState = (): DashboardWorkspaceCaptureState => {
  const filters = makeFilters();
  const images: LoadedImage[] = [
    {
      id: 'img-1',
      file: makeWorkspaceFile('cover-page.png'),
      url: 'blob:loaded-image-1',
      width: 640,
      height: 480,
      rotation: 90,
      filters,
    },
  ];
  const downloadItems: DownloadItem[] = [
    {
      name: 'cleaned-page.png',
      blob: makeBlob(DOWNLOAD_BYTES),
      scope: 'cleaner',
      sourceImageId: 'img-1',
      previewUrl: 'blob:download-preview-1',
    },
  ];
  // The capture-state type declares the document shape for aio downloads;
  // runtime values are Blobs. The extra assetId key keeps the fixture honest
  // at the type level while the runtime behavior stays Blob-shaped.
  const aioDownloadBlob = Object.assign(makeBlob(AIO_DOWNLOAD_BYTES), {
    assetId: 'synthetic-aio-download-asset',
  });
  const aioManualEdits: Record<
    string,
    AioManualImageEditState & WorkspaceManualImageEditDocument
  > = {
    'img-1': {
      paintLayerDataUrl: DATA_URL_PNG_HEADER,
      baseImageDataUrl: DATA_URL_TEXT,
      wandMaskDataUrl: null,
      segmentBrushDataUrl: DATA_URL_SEGMENT_BRUSH,
    },
  };
  const aioState = {
    steps: { detectText: true },
    stageSelection: { detectText: 'auto' },
    presetState: { presetId: 'preset-1', version: 2 },
    maskDilation: 4,
    hdStrategy: 'resize',
    hdResizeLimit: 2048,
    hdCropMargin: 16,
    hdCropTriggerSize: 4096,
    detectionsByImage: {},
    selectedRegionByImage: { 'img-1': 'region-1' },
    pipelineSnapshots: [
      {
        key: 'detectText',
        label: 'Detect text',
        detectionsByImage: {},
        selectedRegionByImage: { 'img-1': 'region-1' },
        aioDownloads: [
          {
            fileName: 'detected-page.png',
            blob: aioDownloadBlob,
            sourceImageId: 'img-1',
          },
        ],
      },
    ],
    pipelineSnapshotIndex: 1,
    imageSnapshotIndexById: { 'img-1': 2 },
    autoHistoryAvailable: true,
    autoProcessedImageById: { 'img-1': true },
    manualQuotaChargedByImage: { 'img-1': true },
    manualProgressByImage: {},
    manualImageEditsByImage: aioManualEdits,
  };
  const cleanerState = {
    detectionsByImage: {},
    selectedRegionByImage: {},
    runMetaByImage: {
      'img-1': {
        detected: true,
        ocrCount: 2,
        segmentedCount: 2,
        cleaned: true,
        detectModelKey: 'det-1',
        ocrModelKey: 'ocr-1',
        segmentModelKey: 'seg-1',
        cleanModelKey: 'clean-1',
        sourceLanguage: 'ja',
      },
    },
    processedBaseByImage: { 'img-1': DATA_URL_PNG_HEADER },
    manualImageEditsByImage: {
      'img-1': {
        paintLayerDataUrl: DATA_URL_TEXT,
        baseImageDataUrl: null,
        wandMaskDataUrl: null,
        segmentBrushDataUrl: null,
      },
    },
  };
  const translatorState = {
    srcLang: 'ja',
    tgtLang: 'pt-BR',
    aioSrcLang: 'ja',
    aioTgtLang: 'pt-BR',
    translatorDraftText: 'ドラゴンボール',
    translatorTranslatedText: 'dragon ball',
    translatorLastTextModelUsed: null,
    translatorTextDirty: false,
    translatorDetectionsByImage: {},
    translatorSelectedRegionByImage: {},
    translatorRunMetaByImage: {},
    translatorProcessedBaseByImage: { 'img-1': DATA_URL_TEXT },
  };

  return {
    autosaveScope: 'guest',
    autosaveUserId: null,
    mode: 'aio',
    subMode: 'manual',
    activeImageId: 'img-1',
    viewMode: 'long_strip',
    translatorWorkspaceMode: 'visual',
    translatorVisualProcessingMode: 'standard',
    statusMessage: 'Ready',
    lastActionScope: 'cleaner',
    images,
    downloadItems,
    batchThreadsEnabled: true,
    batchThreads: 3,
    aio: aioState,
    cleaner: cleanerState,
    translator: translatorState,
    typesetter: {
      selectionTool: 'select',
      queueSelectedId: 'q-1',
      snapshotName: 'auto-save',
      selectedSnapshotId: null,
      sessionsByImage: { 'img-1': makeTypesetterSession() },
    },
    enhance: {
      scale: 2,
      profile: 'fast',
      modelId: 'model-1',
      outputFormat: 'png',
    },
    utility: {
      stitch: {
        stitchLayoutMode: 'vertical',
        stitchBatchStrategy: 'fixed',
        stitchBatchSize: 2,
        stitchTargetPrimaryAxis: 1600,
        stitchGap: 0,
        stitchAlignMode: 'none',
        stitchBackground: '#000000',
        stitchSingleExportFormat: 'png',
        stitchFileBaseName: 'stitch',
        stitchSelectedBatchIndex: 0,
        stitchBatchIndexes: [[0, 1]],
      },
      splitter: {
        recipe: { layout: 'vertical' },
        imageStates: {},
        activeImageId: 'img-1',
      },
      watermark: {
        draft: { text: 'SAMPLE', fontSize: 24 },
        activeImageId: 'img-1',
        compareMode: 'split',
        compareValue: 45,
        selectedPresetId: 'preset-classic',
        autoSuggestion: '',
        userPresets: [],
        watermarkImageFile: makeWorkspaceFile('watermark-source.png'),
        results: [
          {
            sourceImageId: 'img-1',
            name: 'watermarked-1.png',
            blob: makeBlob(WATERMARK_BYTES),
            previewUrl: 'blob:watermark-preview-1',
            resolvedAnchor: 'bottom-right',
          },
        ],
      },
      optimizer: {
        recipe: { quality: 80 },
        selectedPreset: 'balanced',
        activeImageId: 'img-1',
        results: [
          {
            sourceImageId: 'img-1',
            fileName: 'optimized-1.png',
            blob: makeBlob(OPTIMIZER_BYTES),
            previewUrl: 'blob:optimizer-preview-1',
            originalBytes: 1000,
            optimizedBytes: 400,
            width: 640,
            height: 480,
          },
        ],
      },
    },
    llm: {
      llmSettings: { provider: 'openai' },
      customLlmProfiles: [],
      customLlmProfilesMode: 'global',
      pendingCustomSelections: {},
      customLlmDrafts: {},
      freeProviderDrafts: {},
    },
  };
};

const readBlobBytes = async (blob: Blob): Promise<number[]> =>
  Array.from(new Uint8Array(await blob.arrayBuffer()));

describe('workspace history round trip', () => {
  it('captures a snapshot with pooled handles and v2 quota semantics', () => {
    const state = buildCaptureState();
    const originalFile = requireValue(state.images[0], 'image').file;
    const originalWatermarkSourceFile = state.utility.watermark.watermarkImageFile;
    const snapshot = captureWorkspaceHistorySnapshot(state);
    try {
      expect(snapshot.mode).toBe('aio');
      expect(snapshot.subMode).toBe('manual');
      expect(snapshot.activeImageId).toBe('img-1');
      expect(snapshot.batchThreadsEnabled).toBe(true);
      expect(snapshot.batchThreads).toBe(3);

      expect(snapshot.images).toHaveLength(1);
      const snapshotImage = requireValue(snapshot.images[0], 'snapshot image');
      expect(snapshotImage.file).toBe(originalFile);
      expect(snapshotImage.width).toBe(640);
      expect(snapshotImage.height).toBe(480);
      expect(snapshotImage.rotation).toBe(90);
      expect(snapshotImage.filters).toEqual(makeFilters());

      expect(snapshot.downloadItems).toHaveLength(1);
      const snapshotDownload = requireValue(snapshot.downloadItems[0], 'snapshot download');
      expect(snapshotDownload.name).toBe('cleaned-page.png');
      expect(snapshotDownload.scope).toBe('cleaner');
      expect(snapshotDownload.sourceImageId).toBe('img-1');
      expect(snapshotDownload.blob.__historyKind).toBe('blob');
      expect(snapshotDownload.blob.type).toBe('image/png');
      expect(snapshotDownload.blob.size).toBe(DOWNLOAD_BYTES.length);

      // v2 never charges manual quota; the history snapshot resets the map.
      expect(snapshot.aio.manualQuotaChargedByImage).toEqual({});
      const snapshotPipeline = requireValue(
        snapshot.aio.pipelineSnapshots[0],
        'snapshot pipeline snapshot',
      );
      const snapshotAioDownload = requireValue(
        snapshotPipeline.aioDownloads[0],
        'snapshot aio download',
      );
      expect(snapshotAioDownload.blob.__historyKind).toBe('blob');
      const snapshotAioEdit = requireValue(
        snapshot.aio.manualImageEditsByImage['img-1'],
        'snapshot aio edit',
      );
      expect(snapshotAioEdit.paintLayerDataUrl?.__historyKind).toBe('data-url');
      const snapshotCleanerBase = requireValue(
        snapshot.cleaner.processedBaseByImage['img-1'],
        'snapshot cleaner base',
      );
      expect(snapshotCleanerBase.__historyKind).toBe('data-url');

      // History watermark results blank the derived previewUrl.
      expect(snapshot.utility.watermark.results).toHaveLength(1);
      const snapshotWatermarkResult = requireValue(
        snapshot.utility.watermark.results[0],
        'snapshot watermark result',
      );
      expect(snapshotWatermarkResult.previewUrl).toBe('');
      expect(snapshotWatermarkResult.blob.__historyKind).toBe('blob');
      expect(snapshot.utility.watermark.watermarkImageFile).toBe(originalWatermarkSourceFile);

      // Optimizer results exclude the leaked previewUrl entirely.
      expect(snapshot.utility.optimizer.results).toHaveLength(1);
      const snapshotOptimizerResult = requireValue(
        snapshot.utility.optimizer.results[0],
        'snapshot optimizer result',
      );
      expect('previewUrl' in snapshotOptimizerResult).toBe(false);
      expect(snapshotOptimizerResult.blob.__historyKind).toBe('blob');
    } finally {
      releaseWorkspaceHistorySnapshot(snapshot);
    }
  });

  it('restores runtime payloads referencing the pooled originals', async () => {
    const state = buildCaptureState();
    const originalFile = requireValue(state.images[0], 'image').file;
    const originalDownloadBlob = requireValue(state.downloadItems[0], 'download').blob;
    const originalAioDownloadBlob = requireValue(
      requireValue(state.aio.pipelineSnapshots[0], 'pipeline snapshot').aioDownloads[0],
      'aio download',
    ).blob;
    const originalWatermarkBlob = requireValue(
      state.utility.watermark.results[0],
      'watermark result',
    ).blob;
    const originalOptimizerBlob = requireValue(
      state.utility.optimizer.results[0],
      'optimizer result',
    ).blob;
    const originalWatermarkSourceFile = state.utility.watermark.watermarkImageFile;

    const snapshot = captureWorkspaceHistorySnapshot(state);
    try {
      const restored = await restoreWorkspaceHistorySnapshot(snapshot);

      expect(restored.images).toHaveLength(1);
      const restoredImage = requireValue(restored.images[0], 'restored image');
      expect(restoredImage.id).toBe('img-1');
      expect(restoredImage.file).toBe(originalFile);
      expect(restoredImage.url).toMatch(/^blob:/);
      expect(restoredImage.width).toBe(640);
      expect(restoredImage.height).toBe(480);
      expect(restoredImage.rotation).toBe(90);
      expect(restoredImage.filters).toEqual(makeFilters());

      expect(restored.downloadItems).toHaveLength(1);
      const restoredDownload = requireValue(restored.downloadItems[0], 'restored download');
      expect(restoredDownload.name).toBe('cleaned-page.png');
      expect(restoredDownload.scope).toBe('cleaner');
      expect(restoredDownload.sourceImageId).toBe('img-1');
      expect(restoredDownload.blob).toBe(originalDownloadBlob);
      expect(restoredDownload.previewUrl).toMatch(/^blob:/);

      const restoredPipeline = requireValue(
        restored.aio.pipelineSnapshots[0],
        'restored pipeline snapshot',
      );
      const restoredAioDownload = requireValue(
        restoredPipeline.aioDownloads[0],
        'restored aio download',
      );
      expect(restoredAioDownload.fileName).toBe('detected-page.png');
      expect(restoredAioDownload.blob).toBe(originalAioDownloadBlob);
      // The restore-state type declares the document shape for this map, but
      // the runtime values resolve back to the original data-url strings.
      expect(restored.aio.manualImageEditsByImage['img-1']).toEqual({
        paintLayerDataUrl: DATA_URL_PNG_HEADER,
        baseImageDataUrl: DATA_URL_TEXT,
        wandMaskDataUrl: null,
      });

      expect(restored.cleaner.processedBaseByImage['img-1']).toBe(DATA_URL_PNG_HEADER);
      const restoredCleanerEdit = requireValue(
        restored.cleaner.manualImageEditsByImage['img-1'],
        'restored cleaner edit',
      );
      expect(restoredCleanerEdit.paintLayerDataUrl).toBe(DATA_URL_TEXT);
      expect(restored.translator.translatorProcessedBaseByImage['img-1']).toBe(DATA_URL_TEXT);

      expect(restored.utility.splitter).toEqual(state.utility.splitter);
      expect(restored.utility.watermark.watermarkImageFile).toBe(originalWatermarkSourceFile);
      expect(restored.utility.watermark.results).toHaveLength(1);
      const restoredWatermarkResult = requireValue(
        restored.utility.watermark.results[0],
        'restored watermark result',
      );
      expect(restoredWatermarkResult.blob).toBe(originalWatermarkBlob);
      expect(restoredWatermarkResult.name).toBe('watermarked-1.png');
      expect(restoredWatermarkResult.resolvedAnchor).toBe('bottom-right');
      expect(restoredWatermarkResult.previewUrl).toMatch(/^blob:/);

      expect(restored.utility.optimizer.results).toHaveLength(1);
      const restoredOptimizerResult = requireValue(
        restored.utility.optimizer.results[0],
        'restored optimizer result',
      );
      expect(restoredOptimizerResult.blob).toBe(originalOptimizerBlob);
      expect(restoredOptimizerResult.fileName).toBe('optimized-1.png');
      expect('previewUrl' in restoredOptimizerResult).toBe(false);

      expect(await readBlobBytes(restoredImage.file)).toEqual(IMAGE_BYTES);
      expect(await readBlobBytes(restoredDownload.blob)).toEqual(DOWNLOAD_BYTES);
    } finally {
      releaseWorkspaceHistorySnapshot(snapshot);
    }
  });

  it('pins the synthesized document shell of a history restore', async () => {
    const state = buildCaptureState();
    const snapshot = captureWorkspaceHistorySnapshot(state);
    try {
      const restored = await restoreWorkspaceHistorySnapshot(snapshot);
      const document = restored.document;

      expect(document.version).toBe(1);
      expect(typeof document.savedAt).toBe('string');
      expect(document.autosaveScope).toBe('guest');
      expect(document.autosaveUserId).toBeNull();
      expect(document.images).toEqual([]);
      expect(document.downloadItems).toEqual([]);
      expect(document.batchThreadsEnabled).toBe(true);
      expect(document.batchThreads).toBe(3);
      expect(document.cleaner.processedBaseAssetByImage).toEqual({});
      expect(document.cleaner.manualImageEditsByImage).toEqual({});
      expect(document.translator.translatorProcessedBaseAssetByImage).toEqual({});
      expect(document.utility.watermark.watermarkImage).toBeNull();
      expect(document.utility.watermark.results).toEqual([]);
      expect(document.utility.optimizer.results).toEqual([]);
      expect(document.typesetter).toEqual(snapshot.typesetter);
    } finally {
      releaseWorkspaceHistorySnapshot(snapshot);
    }
  });

  it('drops pooled assets on release so a second restore is impossible', async () => {
    const state = buildCaptureState();
    const snapshot: DashboardWorkspaceHistorySnapshot = captureWorkspaceHistorySnapshot(state);
    releaseWorkspaceHistorySnapshot(snapshot);

    await expect(restoreWorkspaceHistorySnapshot(snapshot)).rejects.toThrow(
      'The binary history asset is no longer available for restoration.',
    );
  });
});
