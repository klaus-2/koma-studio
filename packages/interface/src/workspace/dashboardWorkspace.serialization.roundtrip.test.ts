import { describe, expect, it } from 'vitest';
import {
  captureWorkspaceDocument,
  restoreWorkspaceDocument,
} from './dashboardWorkspace.serialization';
import type { DashboardWorkspaceCaptureState } from './dashboardWorkspace';
import type {
  AioManualImageEditState,
  DownloadItem,
  ImageFilters,
  LoadedImage,
} from '../types/dashboard.types';
import type { WorkspaceManualImageEditDocument } from '../../../../packages/types/src/workspace';
import type { TypographySession } from '../typography/types';

// jsdom lacks Blob.prototype.arrayBuffer (lib.dom declares it; this runtime
// does not ship it). The capture codecs read binaries through arrayBuffer();
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
// restore path allocates object URLs for images/downloads/watermark results.
// Provide a minimal stub only when the platform does not supply one.
if (typeof URL.createObjectURL !== 'function') {
  let mockObjectUrlCounter = 0;
  URL.createObjectURL = (): string => {
    mockObjectUrlCounter += 1;
    return `blob:mock-object-url-${mockObjectUrlCounter}`;
  };
}

// jsdom does not load subresources, so an <img> used by the thumbnail decoder
// never fires load/error and stalls for its full 30s abort timeout. Make image
// loads fail fast (the restore path treats thumbnail failure as a fallback).
Object.defineProperty(HTMLImageElement.prototype, 'src', {
  configurable: true,
  get: function (this: HTMLImageElement): string {
    return this.getAttribute('src') ?? '';
  },
  set: function (this: HTMLImageElement, _value: string): void {
    queueMicrotask(() => {
      this.dispatchEvent(new Event('error'));
    });
  },
});

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

// The runtime stores keep `AioManualImageEditState` values (data URLs) inside
// the aio slice even though the capture-state type only promises the document
// shape; the production capture builder bridges the two shapes. This fixture
// mirrors the real runtime content so the round trip exercises the real path.
const buildAioManualEdits = (): Record<
  string,
  AioManualImageEditState & WorkspaceManualImageEditDocument
> => ({
  'img-1': {
    paintLayerDataUrl: DATA_URL_PNG_HEADER,
    baseImageDataUrl: DATA_URL_TEXT,
    wandMaskDataUrl: null,
    segmentBrushDataUrl: DATA_URL_SEGMENT_BRUSH,
  },
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
      chapterId: 'archive:cover.cbz',
      chapterLabel: 'cover.cbz',
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
  const aioDownloadBlob = Object.assign(makeBlob(AIO_DOWNLOAD_BYTES), {
    assetId: 'synthetic-aio-download-asset',
  });
  const aioManualEdits = buildAioManualEdits();
  const aioState = {
    steps: { detectText: true, recognizeText: false },
    stageSelection: { detectText: 'auto' },
    presetState: { presetId: 'preset-1', version: 2 },
    maskDilation: 4,
    hdStrategy: 'resize',
    hdResizeLimit: 2048,
    hdCropMargin: 16,
    hdCropTriggerSize: 4096,
    detectionsByImage: {
      'img-1': [{ id: 'det-1', bbox: [0, 0, 10, 10], score: 0.9, label: 'balloon' }],
    },
    selectedRegionByImage: { 'img-1': 'region-1' },
    pipelineSnapshots: [
      {
        key: 'detectText',
        label: 'Detect text',
        detectionsByImage: {
          'img-1': [{ id: 'det-1', bbox: [0, 0, 10, 10], score: 0.9, label: 'balloon' }],
        },
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
    manualQuotaChargedByImage: {},
    manualProgressByImage: {
      'img-1': {
        currentIndex: 1,
        unlockedMaxIndex: 2,
        statusByStage: {
          detectText: 'done',
          recognizeText: 'pending',
          getTranslations: 'locked',
          segmentText: 'locked',
          cleanImage: 'locked',
          render: 'locked',
        },
      },
    },
    manualImageEditsByImage: aioManualEdits,
  };
  const cleanerState = {
    detectionsByImage: {
      'img-1': [{ id: 'clean-det-1', bbox: [2, 2, 8, 8], score: 0.8, label: 'sfx' }],
    },
    selectedRegionByImage: { 'img-1': null },
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
    translatorLastTextModelUsed: 'gpt-4o-mini',
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
        imageStates: { 'img-1': { cropped: false } },
        activeImageId: 'img-1',
      },
      watermark: {
        draft: { text: 'SAMPLE', fontSize: 24 },
        activeImageId: 'img-1',
        compareMode: 'split',
        compareValue: 45,
        selectedPresetId: 'preset-classic',
        autoSuggestion: '',
        userPresets: [{ id: 'up-1', name: 'Mine' }],
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
        textZoneCache: {
          'img-1': [{ id: 'tz-1', bbox: [1, 2, 3, 4], score: 0.5, label: 'text' }],
        },
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
      customLlmProfiles: [{ id: 'prof-1', name: 'Local', updatedAt: 5 }],
      customLlmProfilesMode: 'global',
      pendingCustomSelections: { detectText: null },
      customLlmDrafts: {},
      freeProviderDrafts: {},
    },
  };
};

const readBlobBytes = async (blob: Blob): Promise<number[]> =>
  Array.from(new Uint8Array(await blob.arrayBuffer()));

// The restore-state types declare document asset refs for values that are
// Blobs at runtime; verify that at runtime instead of trusting the shape.
const requireBlob = (value: Blob | { assetId: string }, label: string): Blob => {
  if (value instanceof Blob) {
    return value;
  }
  throw new Error(`Expected ${label} to be a Blob at runtime.`);
};

const roundTrip = async (): Promise<{
  payload: Awaited<ReturnType<typeof captureWorkspaceDocument>>;
  restored: Awaited<ReturnType<typeof restoreWorkspaceDocument>>;
}> => {
  const state = buildCaptureState();
  const payload = await captureWorkspaceDocument(state);
  const restored = await restoreWorkspaceDocument(payload);
  return { payload, restored };
};

describe('workspace document round trip', () => {
  it('captures all 10 asset-bearing fields into distinct collected assets', async () => {
    const { payload } = await roundTrip();

    expect(payload.assets).toHaveLength(11);
    const paths = payload.assets.map((asset) => asset.path);
    expect(paths.some((p) => p.startsWith('assets/images/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('assets/downloads/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('assets/aio-downloads/'))).toBe(true);
    expect(paths.filter((p) => p.startsWith('assets/manual-edits/'))).toHaveLength(3);
    // Both cleaner and translator processed bases share the cleaner-base namespace.
    expect(paths.filter((p) => p.startsWith('assets/cleaner-base/'))).toHaveLength(2);
    expect(paths.some((p) => p.startsWith('assets/watermark-source/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('assets/watermark-results/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('assets/optimizer-results/'))).toBe(true);
    expect(new Set(payload.assets.map((asset) => asset.id)).size).toBe(payload.assets.length);
    expect(
      payload.manifest.assets.every((asset) => asset.byteLength > 0),
    ).toBe(true);
  });

  it('preserves document metadata through capture', async () => {
    const { payload } = await roundTrip();
    const document = payload.manifest.document;

    expect(document.version).toBe(1);
    expect(typeof document.savedAt).toBe('string');
    expect(document.autosaveScope).toBe('guest');
    expect(document.autosaveUserId).toBeNull();
    expect(document.view).toEqual({
      mode: 'aio',
      subMode: 'manual',
      activeImageId: 'img-1',
      viewMode: 'long_strip',
      translatorWorkspaceMode: 'visual',
      translatorVisualProcessingMode: 'standard',
    });
    expect(document.footer).toEqual({
      lastActionScope: 'cleaner',
      statusMessage: 'Ready',
    });
    expect(document.batchThreadsEnabled).toBe(true);
    expect(document.batchThreads).toBe(3);
  });

  it('round-trips images with bytes, metadata and regenerated urls', async () => {
    const { restored } = await roundTrip();

    expect(restored.document.images).toHaveLength(1);
    const documentImage = requireValue(restored.document.images[0], 'document image');
    expect(documentImage.fileName).toBe('cover-page.png');
    expect(documentImage.mimeType).toBe('image/png');
    expect(documentImage.width).toBe(640);
    expect(documentImage.height).toBe(480);
    expect(documentImage.rotation).toBe(90);
    expect(documentImage.chapterId).toBe('archive:cover.cbz');
    expect(documentImage.chapterLabel).toBe('cover.cbz');

    expect(restored.images).toHaveLength(1);
    const image = requireValue(restored.images[0], 'restored image');
    expect(image.id).toBe('img-1');
    expect(image.file.name).toBe('cover-page.png');
    expect(image.file.type).toBe('image/png');
    expect(await readBlobBytes(image.file)).toEqual(IMAGE_BYTES);
    expect(image.url).toMatch(/^blob:/);
    expect(image.thumbnailUrl).toBeUndefined();
    expect(image.width).toBe(640);
    expect(image.height).toBe(480);
    expect(image.rotation).toBe(90);
    expect(image.filters).toEqual(makeFilters());
    expect(image.chapterId).toBe('archive:cover.cbz');
    expect(image.chapterLabel).toBe('cover.cbz');
  });

  it('round-trips download items with blob bytes and fresh preview urls', async () => {
    const { restored } = await roundTrip();

    expect(restored.downloadItems).toHaveLength(1);
    const item = requireValue(restored.downloadItems[0], 'restored download item');
    expect(item.name).toBe('cleaned-page.png');
    expect(item.scope).toBe('cleaner');
    expect(item.sourceImageId).toBe('img-1');
    expect(item.blob.type).toBe('image/png');
    expect(await readBlobBytes(item.blob)).toEqual(DOWNLOAD_BYTES);
    expect(item.previewUrl).toMatch(/^blob:/);
  });

  it('round-trips aio plain state, pipeline snapshots and downloads', async () => {
    const { restored } = await roundTrip();
    const aio = restored.aio;

    expect(aio.steps).toEqual({ detectText: true, recognizeText: false });
    expect(aio.stageSelection).toEqual({ detectText: 'auto' });
    expect(aio.presetState).toEqual({ presetId: 'preset-1', version: 2 });
    expect(aio.maskDilation).toBe(4);
    expect(aio.hdStrategy).toBe('resize');
    expect(aio.hdResizeLimit).toBe(2048);
    expect(aio.hdCropMargin).toBe(16);
    expect(aio.hdCropTriggerSize).toBe(4096);
    expect(aio.detectionsByImage).toEqual({
      'img-1': [{ id: 'det-1', bbox: [0, 0, 10, 10], score: 0.9, label: 'balloon' }],
    });
    expect(aio.selectedRegionByImage).toEqual({ 'img-1': 'region-1' });
    expect(aio.pipelineSnapshotIndex).toBe(1);
    expect(aio.imageSnapshotIndexById).toEqual({ 'img-1': 2 });
    expect(aio.autoHistoryAvailable).toBe(true);
    expect(aio.autoProcessedImageById).toEqual({ 'img-1': true });
    expect(aio.manualQuotaChargedByImage).toEqual({});
  });

  it('round-trips aio pipeline snapshot downloads with exact bytes', async () => {
    const { restored } = await roundTrip();

    expect(restored.aio.pipelineSnapshots).toHaveLength(1);
    const snapshot = requireValue(restored.aio.pipelineSnapshots[0], 'pipeline snapshot');
    expect(snapshot.key).toBe('detectText');
    expect(snapshot.label).toBe('Detect text');
    expect(snapshot.detectionsByImage).toEqual({
      'img-1': [{ id: 'det-1', bbox: [0, 0, 10, 10], score: 0.9, label: 'balloon' }],
    });
    expect(snapshot.selectedRegionByImage).toEqual({ 'img-1': 'region-1' });
    expect(snapshot.aioDownloads).toHaveLength(1);
    const download = requireValue(snapshot.aioDownloads[0], 'aio download');
    expect(download.fileName).toBe('detected-page.png');
    expect(download.sourceImageId).toBe('img-1');
    expect(await readBlobBytes(requireBlob(download.blob, 'aio download blob'))).toEqual(AIO_DOWNLOAD_BYTES);
  });

  it('round-trips manual image edits as data urls and drops v1-unserialized segment brush', async () => {
    const { restored } = await roundTrip();

    // The restore-state type declares the document shape for this map, but the
    // runtime values are data-url edit states; pin the full runtime payload.
    expect(restored.aio.manualImageEditsByImage['img-1']).toEqual({
      paintLayerDataUrl: DATA_URL_PNG_HEADER,
      baseImageDataUrl: DATA_URL_TEXT,
      wandMaskDataUrl: null,
      // Workspace v1 does not serialize segmentBrushDataUrl; restore pins it to null.
      segmentBrushDataUrl: null,
    });
  });

  it('round-trips cleaner state and processed bases as data urls', async () => {
    const { restored } = await roundTrip();
    const cleaner = restored.cleaner;

    expect(cleaner.detectionsByImage).toEqual({
      'img-1': [{ id: 'clean-det-1', bbox: [2, 2, 8, 8], score: 0.8, label: 'sfx' }],
    });
    expect(cleaner.selectedRegionByImage).toEqual({ 'img-1': null });
    expect(cleaner.runMetaByImage).toEqual({
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
    });
    expect(cleaner.processedBaseByImage['img-1']).toBe(DATA_URL_PNG_HEADER);
    const edit = requireValue(cleaner.manualImageEditsByImage['img-1'], 'cleaner edit');
    expect(edit.paintLayerDataUrl).toBe(DATA_URL_TEXT);
    expect(edit.baseImageDataUrl).toBeNull();
    expect(edit.wandMaskDataUrl).toBeNull();
    expect(edit.segmentBrushDataUrl).toBeNull();
  });

  it('round-trips translator state and processed bases', async () => {
    const { restored } = await roundTrip();
    const translator = restored.translator;

    expect(translator.srcLang).toBe('ja');
    expect(translator.tgtLang).toBe('pt-BR');
    expect(translator.aioSrcLang).toBe('ja');
    expect(translator.aioTgtLang).toBe('pt-BR');
    expect(translator.translatorDraftText).toBe('ドラゴンボール');
    expect(translator.translatorTranslatedText).toBe('dragon ball');
    expect(translator.translatorLastTextModelUsed).toBe('gpt-4o-mini');
    expect(translator.translatorTextDirty).toBe(false);
    expect(translator.translatorDetectionsByImage).toEqual({});
    expect(translator.translatorSelectedRegionByImage).toEqual({});
    expect(translator.translatorRunMetaByImage).toEqual({});
    expect(translator.translatorProcessedBaseByImage['img-1']).toBe(DATA_URL_TEXT);
  });

  it('round-trips typesetter sessions and enhance settings', async () => {
    const { restored } = await roundTrip();

    expect(restored.typesetter.selectionTool).toBe('select');
    expect(restored.typesetter.queueSelectedId).toBe('q-1');
    expect(restored.typesetter.snapshotName).toBe('auto-save');
    expect(restored.typesetter.selectedSnapshotId).toBeNull();
    expect(restored.typesetter.sessionsByImage).toEqual({
      'img-1': makeTypesetterSession(),
    });
    // The restore state surfaces enhance/llm only through the document shell.
    expect(restored.document.enhance).toEqual({
      scale: 2,
      profile: 'fast',
      modelId: 'model-1',
      outputFormat: 'png',
    });
  });

  it('round-trips the utility stitch and splitter states', async () => {
    const { restored } = await roundTrip();

    expect(restored.document.utility.stitch).toEqual({
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
    });
    expect(restored.utility.splitter).toEqual({
      recipe: { layout: 'vertical' },
      imageStates: { 'img-1': { cropped: false } },
      activeImageId: 'img-1',
    });
  });

  it('round-trips watermark state including source file, results and text zone cache', async () => {
    const { restored } = await roundTrip();
    const watermark = restored.utility.watermark;

    expect(watermark.draft).toEqual({ text: 'SAMPLE', fontSize: 24 });
    expect(watermark.activeImageId).toBe('img-1');
    expect(watermark.compareMode).toBe('split');
    expect(watermark.compareValue).toBe(45);
    expect(watermark.selectedPresetId).toBe('preset-classic');
    expect(watermark.autoSuggestion).toBe('');
    expect(watermark.userPresets).toEqual([{ id: 'up-1', name: 'Mine' }]);
    const sourceFile = watermark.watermarkImageFile;
    expect(sourceFile).not.toBeNull();
    expect(sourceFile?.name).toBe('watermark-source.png');
    expect(sourceFile?.type).toBe('image/png');
    if (sourceFile) {
      expect(await readBlobBytes(sourceFile)).toEqual(IMAGE_BYTES);
    }
    expect(watermark.textZoneCache).toEqual({
      'img-1': [{ id: 'tz-1', bbox: [1, 2, 3, 4], score: 0.5, label: 'text' }],
    });
  });

  it('round-trips watermark results with blob bytes and fresh preview urls', async () => {
    const { restored } = await roundTrip();

    expect(restored.utility.watermark.results).toHaveLength(1);
    const result = requireValue(
      restored.utility.watermark.results[0],
      'restored watermark result',
    );
    expect(result.sourceImageId).toBe('img-1');
    expect(result.name).toBe('watermarked-1.png');
    expect(result.resolvedAnchor).toBe('bottom-right');
    expect(await readBlobBytes(result.blob)).toEqual(WATERMARK_BYTES);
    expect(result.previewUrl).toMatch(/^blob:/);
  });

  it('round-trips optimizer results with blob bytes and blank-keep previewUrl', async () => {
    const { restored } = await roundTrip();

    expect(restored.utility.optimizer.recipe).toEqual({ quality: 80 });
    expect(restored.utility.optimizer.selectedPreset).toBe('balanced');
    expect(restored.utility.optimizer.activeImageId).toBe('img-1');
    expect(restored.utility.optimizer.results).toHaveLength(1);
    const result = requireValue(
      restored.utility.optimizer.results[0],
      'restored optimizer result',
    );
    expect(result.sourceImageId).toBe('img-1');
    expect(result.fileName).toBe('optimized-1.png');
    expect(result.originalBytes).toBe(1000);
    expect(result.optimizedBytes).toBe(400);
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
    expect(await readBlobBytes(result.blob)).toEqual(OPTIMIZER_BYTES);
    // Current behavior: the optimizer previewUrl is never captured; restore
    // canonicalizes it as blank-keep ("" — matches the history variant).
    expect(result.previewUrl).toBe('');
  });

  it('round-trips the llm block', async () => {
    const { restored } = await roundTrip();

    expect(restored.document.llm).toEqual({
      llmSettings: { provider: 'openai' },
      customLlmProfiles: [{ id: 'prof-1', name: 'Local', updatedAt: 5 }],
      customLlmProfilesMode: 'global',
      pendingCustomSelections: { detectText: null },
      customLlmDrafts: {},
      freeProviderDrafts: {},
    });
  });
});
