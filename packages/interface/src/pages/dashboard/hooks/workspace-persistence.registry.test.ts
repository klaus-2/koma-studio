/**
 * Workspace persistence parity tests.
 *
 * Pins the binding contracts:
 * 1. SIGNATURE PARITY across a synthetic restore cycle: capture → serialize →
 *    restore document → apply to stores → capture again yields IDENTICAL
 *    buildWorkspaceHistorySignature and buildWorkspaceAutosaveSignature
 *    strings (full string equality — order + presence, not deep equality).
 * 2. STRUCTURE: capture key order (part of the signature contract), the v1
 *    manualQuotaChargedByImage synthesis, absence of document-only asset keys
 *    in the applied stores, the optional legacy-field defaults, and the
 *    unified store subscription list.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWorkspaceAutosaveSignature, buildWorkspaceHistorySignature } from '../../../workspace/dashboardWorkspace.signature';
import {
  captureWorkspaceDocument,
  restoreWorkspaceDocument,
} from '../../../workspace/dashboardWorkspace.serialization';
import type {
  AioManualImageEditState,
  DownloadItem,
  ImageFilters,
  LoadedImage,
} from '../../../types/dashboard.types';
import type { TypographySession } from '../../../typography/types';
import { createDefaultSplitterRecipe } from '../../../components/dashboard/splitter/splitterUtils';
import { createDefaultWatermarkDraft } from '../../../components/dashboard/watermark/watermark-core.js';
import {
  WORKSPACE_PERSISTENCE_STORES,
  applyRestoredWorkspaceToStores,
  buildWorkspaceCaptureState,
} from './workspace-persistence.registry';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useStatusStore } from '../stores/status-store';
import { useExportStore } from '../stores/export-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useTypographerStore } from '../stores/typographer-store';
import { useEnhanceStore } from '../stores/enhance-store';
import { useUtilityStore } from '../stores/utility-store';
import { useWorkspacePersistenceStore } from '../stores/workspace-persistence-store';

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

// The signature replacer includes File.lastModified; the restore path stamps
// restored files with Date.now(). Freeze Date.now for the whole cycle so both
// sides construct files with the same signature-visible metadata.
const FROZEN_NOW_MS = 1700000000000;

const DATA_URL_PNG_HEADER = 'data:image/png;base64,iVBORw0KGgo=';
const DATA_URL_TEXT = 'data:image/png;base64,aGVsbG8=';
const IMAGE_BYTES = [137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4];
const DOWNLOAD_BYTES = [10, 20, 30, 40, 50];
const AIO_DOWNLOAD_BYTES = [100, 101, 102];
const WATERMARK_BYTES = [200, 201, 202];
const OPTIMIZER_BYTES = [250, 251, 252];

/** Capture key order is signature-visible; this fixture pins the contract. */
const EXPECTED_CAPTURE_KEYS = {
  root: [
    'autosaveScope',
    'autosaveUserId',
    'mode',
    'subMode',
    'activeImageId',
    'viewMode',
    'translatorWorkspaceMode',
    'translatorVisualProcessingMode',
    'statusMessage',
    'lastActionScope',
    'images',
    'downloadItems',
    'batchThreadsEnabled',
    'batchThreads',
    'aio',
    'cleaner',
    'translator',
    'typesetter',
    'enhance',
    'utility',
    'llm',
  ],
  aio: [
    'steps',
    'stageSelection',
    'presetState',
    'maskDilation',
    'hdStrategy',
    'hdResizeLimit',
    'hdCropMargin',
    'hdCropTriggerSize',
    'detectionsByImage',
    'selectedRegionByImage',
    'pipelineSnapshots',
    'pipelineSnapshotIndex',
    'imageSnapshotIndexById',
    'autoHistoryAvailable',
    'autoProcessedImageById',
    'manualQuotaChargedByImage',
    'manualProgressByImage',
    'manualImageEditsByImage',
  ],
  cleaner: [
    'detectionsByImage',
    'selectedRegionByImage',
    'processedBaseByImage',
    'runMetaByImage',
    'manualImageEditsByImage',
  ],
  translator: [
    'srcLang',
    'tgtLang',
    'aioSrcLang',
    'aioTgtLang',
    'translatorDraftText',
    'translatorTranslatedText',
    'translatorLastTextModelUsed',
    'translatorTextDirty',
    'translatorDetectionsByImage',
    'translatorSelectedRegionByImage',
    'translatorRunMetaByImage',
    'translatorProcessedBaseByImage',
  ],
  typesetter: [
    'selectionTool',
    'queueSelectedId',
    'snapshotName',
    'selectedSnapshotId',
    'sessionsByImage',
  ],
  enhance: ['scale', 'profile', 'modelId', 'outputFormat'],
  utility: ['stitch', 'splitter', 'watermark', 'optimizer'],
  stitch: [
    'stitchLayoutMode',
    'stitchBatchStrategy',
    'stitchBatchSize',
    'stitchTargetPrimaryAxis',
    'stitchGap',
    'stitchAlignMode',
    'stitchBackground',
    'stitchSingleExportFormat',
    'stitchFileBaseName',
    'stitchSelectedBatchIndex',
    'stitchBatchIndexes',
  ],
  watermark: [
    'draft',
    'activeImageId',
    'compareMode',
    'compareValue',
    'selectedPresetId',
    'autoSuggestion',
    'userPresets',
    'watermarkImageFile',
    'results',
    'textZoneCache',
  ],
  optimizer: ['recipe', 'selectedPreset', 'activeImageId', 'results'],
  llm: [
    'llmSettings',
    'customLlmProfiles',
    'customLlmProfilesMode',
    'pendingCustomSelections',
    'customLlmDrafts',
    'freeProviderDrafts',
  ],
} as const;

const makeWorkspaceFile = (name: string): File =>
  new File([new Uint8Array(IMAGE_BYTES)], name, {
    type: 'image/png',
    lastModified: FROZEN_NOW_MS,
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

const makeManualImageEdits = (): AioManualImageEditState => ({
  paintLayerDataUrl: DATA_URL_PNG_HEADER,
  baseImageDataUrl: null,
  wandMaskDataUrl: DATA_URL_TEXT,
  // Workspace v1 does not serialize segmentBrush; restore preserves the rest.
  segmentBrushDataUrl: null,
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
      createdAt: FROZEN_NOW_MS,
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
  updatedAt: FROZEN_NOW_MS,
});

const makeLlmSettings = () => ({
  extra_context: '',
  image_input_enabled: true,
  temperature: 0.7,
  top_p: 0.9,
  max_tokens: 2048,
  translation_notes_enabled: false,
  neighbor_image_context_enabled: false,
  glossary: [],
});

const makeLlmProfiles = () => [
  {
    id: 'p-1',
    stage: 'translation' as const,
    label: 'Alpha Profile',
    apiBase: 'https://api-1.example',
    apiKey: 'key-1',
    model: 'model-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 'p-2',
    stage: 'ocr' as const,
    label: 'Beta Profile',
    apiBase: 'https://api-2.example',
    apiKey: 'key-2',
    model: 'model-2',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
];

const makeLlmDraft = () => ({
  id: null,
  label: '',
  apiBase: '',
  apiKey: '',
  model: '',
});

/**
 * Seeds the domain stores with the synthetic workspace content. Store defaults
 * are kept for the complex typed slots the fixture does not exercise (preset
 * state, catalogs) — they are deterministic per test file and JSON-safe.
 */
const seedWorkspaceStores = (): void => {
  const images: LoadedImage[] = [
    {
      id: 'img-1',
      file: makeWorkspaceFile('cover-page.png'),
      url: 'blob:loaded-image-1',
      width: 640,
      height: 480,
      rotation: 90,
      filters: makeFilters(),
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

  useUiShellStore.setState({
    mode: 'aio',
    subMode: 'manual',
    viewMode: 'long_strip',
  });
  useImageCollectionStore.setState({ images, activeId: 'img-1' });
  useStatusStore.setState({ statusMessage: 'Ready' });
  useExportStore.setState({ downloadItems, lastActionScope: 'cleaner' });
  useAioPipelineStore.setState({
    batchThreadsEnabled: true,
    batchThreads: 3,
    aioPipelineSnapshots: [
      {
        key: 'cleanImage',
        label: 'Clean',
        detectionsByImage: {},
        selectedRegionByImage: {},
        aioDownloads: [
          {
            fileName: 'cleaned-1.png',
            blob: makeBlob(AIO_DOWNLOAD_BYTES),
            sourceImageId: 'img-1',
          },
        ],
      },
    ],
    aioPipelineSnapshotIndex: 0,
    aioImageSnapshotIndexById: { 'img-1': 0 },
    aioAutoHistoryAvailable: true,
    aioAutoProcessedImageById: {},
    aioManualProgressByImage: {},
    aioSrcLang: 'ja',
    aioTgtLang: 'pt-br',
  });
  useRegionEditorStore.setState({
    aioDetectionsByImage: {},
    aioSelectedRegionByImage: { 'img-1': 'region-1' },
  });
  useManualToolsStore.setState({
    aioManualImageEditsByImage: { 'img-1': makeManualImageEdits() },
  });
  useCleanerStore.setState({
    cleanerDetectionsByImage: {},
    cleanerSelectedRegionByImage: { 'img-1': 'region-1' },
    cleanerProcessedBaseByImage: { 'img-1': DATA_URL_PNG_HEADER },
    cleanerRunMetaByImage: {
      'img-1': {
        detected: true,
        ocrCount: 2,
        segmentedCount: 2,
        cleaned: true,
        detectModelKey: 'detector',
        ocrModelKey: 'ocr',
        segmentModelKey: 'segment',
        cleanModelKey: 'clean',
        sourceLanguage: 'ja',
      },
    },
    cleanerManualImageEditsByImage: { 'img-1': makeManualImageEdits() },
  });
  useTranslatorStore.setState({
    srcLang: 'ja',
    tgtLang: 'pt-br',
    translatorWorkspaceMode: 'visual',
    translatorVisualProcessingMode: 'standard',
    translatorDraftText: 'ドラゴンボール',
    translatorTranslatedText: 'dragon ball',
    translatorLastTextModelUsed: null,
    translatorTextDirty: false,
    translatorDetectionsByImage: {},
    translatorSelectedRegionByImage: {},
    translatorRunMetaByImage: {},
    translatorProcessedBaseByImage: { 'img-1': DATA_URL_TEXT },
  });
  useTypographerStore.setState({
    typographerSelectionTool: 'select',
    typographerQueueSelectedId: 'q-1',
    typographerSnapshotName: 'auto-save',
    typographerSelectedSnapshotId: null,
    typographerSessionsByImage: { 'img-1': makeTypesetterSession() },
  });
  useEnhanceStore.setState({
    enhanceScale: 2,
    enhanceProfile: 'manga_scan',
    enhanceModelId: 'model-1',
    enhanceOutputFormat: 'png',
  });
  useUtilityStore.setState({
    stitchLayoutMode: 'webtoon',
    stitchBatchStrategy: 'fixed-count',
    stitchBatchSize: 3,
    stitchTargetPrimaryAxis: 12000,
    stitchGap: 0,
    stitchAlignMode: 'center',
    stitchBackground: '#ffffff',
    stitchSingleExportFormat: 'png',
    stitchFileBaseName: 'koma-stitch',
    stitchSelectedBatchIndex: 0,
    stitchBatchIndexes: [[0, 1]],
    splitterWorkspaceState: {
      recipe: createDefaultSplitterRecipe(),
      imageStates: {},
      activeImageId: 'img-1',
    },
    // Key order matches the restore-side literal (restoreWatermarkState /
    // restoreOptimizerState) — whole-object key order is signature-visible.
    watermarkWorkspaceState: {
      draft: createDefaultWatermarkDraft(),
      activeImageId: 'img-1',
      compareMode: 'split',
      compareValue: 45,
      selectedPresetId: 'preset-classic',
      autoSuggestion: '',
      userPresets: [],
      watermarkImageFile: null,
      results: [
        {
          sourceImageId: 'img-1',
          name: 'watermarked-1.png',
          blob: makeBlob(WATERMARK_BYTES),
          previewUrl: 'blob:watermark-preview-1',
          resolvedAnchor: 'bottom-right',
        },
      ],
      textZoneCache: {},
    },
    optimizerWorkspaceState: {
      recipe: { quality: 80 },
      selectedPreset: 'web-light',
      activeImageId: 'img-1',
      // previewUrl: '' — the canonical blank-keep value the restore path
      // emits (the derived previewUrl is never captured); the whole optimizer
      // object is signature-visible, so both sides must agree on it.
      results: [
        {
          sourceImageId: 'img-1',
          fileName: 'optimized-1.png',
          blob: makeBlob(OPTIMIZER_BYTES),
          originalBytes: 1000,
          optimizedBytes: 400,
          width: 640,
          height: 480,
          previewUrl: '',
        },
      ],
    },
  });
  useLlmProvidersStore.setState({
    llmSettings: makeLlmSettings(),
    customLlmProfiles: makeLlmProfiles(),
    customLlmProfilesMode: 'browser_local',
    pendingCustomSelections: { translation: null, ocr: null, clean: null },
    customLlmDrafts: {
      translation: makeLlmDraft(),
      ocr: makeLlmDraft(),
      clean: makeLlmDraft(),
    },
  });
};

const applyRestored = (
  restored: Awaited<ReturnType<typeof restoreWorkspaceDocument>>,
): void => {
  applyRestoredWorkspaceToStores(restored, {
    releaseWorkspaceObjectUrls: () => undefined,
    statusMessageFallback: 'fallback-status',
    statusDetail: 'parity-test-status-detail',
  });
};

describe('workspace persistence registry', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW_MS);
    seedWorkspaceStores();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces identical signatures for the live state and the state re-captured after restore', async () => {
    const liveState = buildWorkspaceCaptureState(null);
    const payload = await captureWorkspaceDocument(liveState);
    const restored = await restoreWorkspaceDocument(payload);
    applyRestored(restored);
    const rebuiltState = buildWorkspaceCaptureState(null);

    expect(buildWorkspaceHistorySignature(rebuiltState)).toBe(
      buildWorkspaceHistorySignature(liveState),
    );
    expect(buildWorkspaceAutosaveSignature(rebuiltState)).toBe(
      buildWorkspaceAutosaveSignature(liveState),
    );
  });

  it('does not leak document-only asset keys into the applied stores', async () => {
    const payload = await captureWorkspaceDocument(buildWorkspaceCaptureState(null));
    const restored = await restoreWorkspaceDocument(payload);
    applyRestored(restored);
    const rebuiltState = buildWorkspaceCaptureState(null);

    expect(Object.keys(rebuiltState.translator)).not.toContain(
      'translatorProcessedBaseAssetByImage',
    );
    expect(Object.keys(rebuiltState.cleaner)).not.toContain(
      'processedBaseAssetByImage',
    );
    expect(Object.keys(rebuiltState.translator)).toEqual(
      EXPECTED_CAPTURE_KEYS.translator,
    );
  });

  it('defaults a legacy document without translatorVisualProcessingMode to standard', async () => {
    const payload = await captureWorkspaceDocument(buildWorkspaceCaptureState(null));
    const legacyView: { translatorVisualProcessingMode?: string } =
      payload.manifest.document.view;
    delete legacyView.translatorVisualProcessingMode;

    const restored = await restoreWorkspaceDocument(payload);
    applyRestored(restored);

    expect(useTranslatorStore.getState().translatorVisualProcessingMode).toBe(
      'standard',
    );
    expect(
      buildWorkspaceCaptureState(null).translatorVisualProcessingMode,
    ).toBe('standard');
  });

  it('lands a legacy organize workspace on AIO', async () => {
    const payload = await captureWorkspaceDocument(buildWorkspaceCaptureState(null));
    const legacyView: { mode: string } = payload.manifest.document.view;
    legacyView.mode = 'organize';

    const restored = await restoreWorkspaceDocument(payload);
    applyRestored(restored);

    expect(useUiShellStore.getState().mode).toBe('aio');
    expect(buildWorkspaceCaptureState(null).mode).toBe('aio');
  });

  it('reads the legacy inline translator processed-base map when the asset map is absent', async () => {
    const payload = await captureWorkspaceDocument(buildWorkspaceCaptureState(null));
    const translatorDocument: {
      translatorProcessedBaseAssetByImage?: Record<string, unknown>;
      translatorProcessedBaseByImage?: Record<string, string>;
    } = payload.manifest.document.translator;
    delete translatorDocument.translatorProcessedBaseAssetByImage;
    translatorDocument.translatorProcessedBaseByImage = {
      'img-1': DATA_URL_TEXT,
    };

    const restored = await restoreWorkspaceDocument(payload);

    expect(restored.translator.translatorProcessedBaseByImage).toEqual({
      'img-1': DATA_URL_TEXT,
    });
  });

  it('keeps the v1 manualQuotaChargedByImage synthesis', () => {
    const liveState = buildWorkspaceCaptureState(null);

    expect(liveState.aio.manualQuotaChargedByImage).toEqual({});
  });

  it('builds the capture state in the signature-visible key order', () => {
    const liveState = buildWorkspaceCaptureState(null);

    expect(Object.keys(liveState)).toEqual([...EXPECTED_CAPTURE_KEYS.root]);
    expect(Object.keys(liveState.aio)).toEqual([...EXPECTED_CAPTURE_KEYS.aio]);
    expect(Object.keys(liveState.cleaner)).toEqual([
      ...EXPECTED_CAPTURE_KEYS.cleaner,
    ]);
    expect(Object.keys(liveState.translator)).toEqual([
      ...EXPECTED_CAPTURE_KEYS.translator,
    ]);
    expect(Object.keys(liveState.typesetter)).toEqual([
      ...EXPECTED_CAPTURE_KEYS.typesetter,
    ]);
    expect(Object.keys(liveState.enhance)).toEqual([
      ...EXPECTED_CAPTURE_KEYS.enhance,
    ]);
    expect(Object.keys(liveState.utility)).toEqual([
      ...EXPECTED_CAPTURE_KEYS.utility,
    ]);
    expect(Object.keys(liveState.utility.stitch)).toEqual([
      ...EXPECTED_CAPTURE_KEYS.stitch,
    ]);
    expect(Object.keys(liveState.utility.watermark)).toEqual([
      ...EXPECTED_CAPTURE_KEYS.watermark,
    ]);
    expect(Object.keys(liveState.utility.optimizer)).toEqual([
      ...EXPECTED_CAPTURE_KEYS.optimizer,
    ]);
    expect(Object.keys(liveState.llm)).toEqual([...EXPECTED_CAPTURE_KEYS.llm]);
  });

  it('exposes the unified 14-store subscription list', () => {
    expect(WORKSPACE_PERSISTENCE_STORES).toEqual([
      useUiShellStore,
      useImageCollectionStore,
      useStatusStore,
      useExportStore,
      useAioPipelineStore,
      useRegionEditorStore,
      useManualToolsStore,
      useCleanerStore,
      useTranslatorStore,
      useTypographerStore,
      useEnhanceStore,
      useUtilityStore,
      useLlmProvidersStore,
      useWorkspacePersistenceStore,
    ]);
  });
});
