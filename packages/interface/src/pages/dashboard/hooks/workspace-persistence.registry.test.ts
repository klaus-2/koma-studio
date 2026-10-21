/**
 * Workspace persistence registry parity tests.
 *
 * Pins the two binding contracts of the registry:
 * 1. SIGNATURE PARITY across a synthetic restore cycle — the capture state
 *    built from the live stores and the capture state rebuilt from the
 *    restored document (and the capture state re-built from the stores after
 *    the registry apply) produce IDENTICAL buildWorkspaceHistorySignature and
 *    buildWorkspaceAutosaveSignature strings (full string equality — order +
 *    presence, not deep-equality). This is the within-session
 *    signature-duality fix proof: the legacy restored-side builder leaked
 *    document-only keys (translatorProcessedBaseAssetByImage) into the
 *    rebuilt state.
 * 2. STRUCTURE — the built capture state's key order matches the registry's
 *    declared field tables, the v1 manualQuotaChargedByImage synthesis is
 *    present, the document-only asset keys are absent from the rebuilt state,
 *    and the unified store list is the expected 14-store set.
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
  FreeProviderDraftMap,
  ImageFilters,
  LoadedImage,
} from '../../../types/dashboard.types';
import type { TypographySession } from '../../../typography/types';
import { createDefaultSplitterRecipe } from '../../../components/dashboard/splitter/splitterUtils';
import { createDefaultWatermarkDraft } from '../../../components/dashboard/watermark/watermark-core.js';
import {
  WORKSPACE_CAPTURE_ROOT_KEYS,
  WORKSPACE_CAPTURE_SLICES,
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

describe('workspace persistence registry', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW_MS);
    seedWorkspaceStores();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces identical signatures for the live state and the restored-cycle rebuild', async () => {
    const liveState = buildWorkspaceCaptureState({
      kind: 'live',
      values: { authUserId: null, freeProviderDrafts: {} },
    });
    const payload = await captureWorkspaceDocument(liveState);
    const restored = await restoreWorkspaceDocument(payload);
    const rebuiltState = buildWorkspaceCaptureState({ kind: 'restored', restored });

    expect(buildWorkspaceHistorySignature(rebuiltState)).toBe(
      buildWorkspaceHistorySignature(liveState),
    );
    expect(buildWorkspaceAutosaveSignature(rebuiltState)).toBe(
      buildWorkspaceAutosaveSignature(liveState),
    );
  });

  it('keeps signature parity when the stores are re-captured after the registry apply', async () => {
    const liveState = buildWorkspaceCaptureState({
      kind: 'live',
      values: { authUserId: null, freeProviderDrafts: {} },
    });
    const payload = await captureWorkspaceDocument(liveState);
    const restored = await restoreWorkspaceDocument(payload);

    let freeProviderDrafts: FreeProviderDraftMap = {};
    applyRestoredWorkspaceToStores(restored, {
      releaseWorkspaceObjectUrls: () => undefined,
      typographerWorkspace: {
        replaceSessionsByImage: (sessions) => {
          useTypographerStore.getState().setTypographerSessionsByImage(sessions);
        },
      },
      setFreeProviderDrafts: (value) => {
        freeProviderDrafts = value;
      },
      statusMessageFallback: 'fallback-status',
      statusDetail: 'parity-test-status-detail',
    });

    const rebuiltFromStores = buildWorkspaceCaptureState({
      kind: 'live',
      values: { authUserId: null, freeProviderDrafts },
    });

    expect(buildWorkspaceHistorySignature(rebuiltFromStores)).toBe(
      buildWorkspaceHistorySignature(liveState),
    );
    expect(buildWorkspaceAutosaveSignature(rebuiltFromStores)).toBe(
      buildWorkspaceAutosaveSignature(liveState),
    );
  });

  it('does not leak document-only asset keys into the rebuilt capture state', async () => {
    const liveState = buildWorkspaceCaptureState({
      kind: 'live',
      values: { authUserId: null, freeProviderDrafts: {} },
    });
    const payload = await captureWorkspaceDocument(liveState);
    const restored = await restoreWorkspaceDocument(payload);
    const rebuiltState = buildWorkspaceCaptureState({ kind: 'restored', restored });

    expect(Object.keys(rebuiltState.translator)).not.toContain(
      'translatorProcessedBaseAssetByImage',
    );
    expect(Object.keys(rebuiltState.cleaner)).not.toContain(
      'processedBaseAssetByImage',
    );
    expect(Object.keys(rebuiltState.translator)).toEqual(
      Object.keys(liveState.translator),
    );
  });

  it('keeps the v1 manualQuotaChargedByImage synthesis', () => {
    const liveState = buildWorkspaceCaptureState({
      kind: 'live',
      values: { authUserId: null, freeProviderDrafts: {} },
    });

    expect(liveState.aio.manualQuotaChargedByImage).toEqual({});
  });

  it('builds the capture state in the registry-declared key order', () => {
    const liveState = buildWorkspaceCaptureState({
      kind: 'live',
      values: { authUserId: null, freeProviderDrafts: {} },
    });

    expect(Object.keys(liveState)).toEqual([...WORKSPACE_CAPTURE_ROOT_KEYS]);

    const keysByGroup = new Map<string, string[]>();
    for (const slice of WORKSPACE_CAPTURE_SLICES) {
      if (slice.key === '') {
        for (const field of slice.fields) {
          expect(Object.keys(liveState)).toContain(field.key);
        }
        continue;
      }
      keysByGroup.set(
        slice.key,
        slice.fields.map((field) => field.key),
      );
    }

    expect(Object.keys(liveState.aio)).toEqual(keysByGroup.get('aio'));
    expect(Object.keys(liveState.cleaner)).toEqual(keysByGroup.get('cleaner'));
    expect(Object.keys(liveState.translator)).toEqual(keysByGroup.get('translator'));
    expect(Object.keys(liveState.typesetter)).toEqual(keysByGroup.get('typesetter'));
    expect(Object.keys(liveState.enhance)).toEqual(keysByGroup.get('enhance'));
    expect(Object.keys(liveState.llm)).toEqual(keysByGroup.get('llm'));

    // utility: dotted descriptors — top-level groups + nested stitch keys.
    const utilityFields = keysByGroup.get('utility') ?? [];
    const utilityGroups = utilityFields.map((key) => key.split('.')[0]);
    expect(Object.keys(liveState.utility)).toEqual([
      ...new Set(utilityGroups),
    ]);
    expect(Object.keys(liveState.utility.stitch)).toEqual(
      utilityFields
        .filter((key) => key.startsWith('stitch.'))
        .map((key) => key.slice('stitch.'.length)),
    );
    expect(Object.keys(liveState.utility.watermark)).toEqual(
      utilityFields
        .filter((key) => key.startsWith('watermark.'))
        .map((key) => key.slice('watermark.'.length)),
    );
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
