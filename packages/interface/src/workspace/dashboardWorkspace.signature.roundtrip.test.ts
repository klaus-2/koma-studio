import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceAutosaveSignature,
  buildWorkspaceHistorySignature,
} from './dashboardWorkspace.signature';
import type { DashboardWorkspaceCaptureState } from './dashboardWorkspace';
import type { DownloadItem, ImageFilters, LoadedImage } from '../types/dashboard.types';
import type { OptimizationResult } from '../types';
import type { TypographySession } from '../typography/types';

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
const IMAGE_BYTES = [137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4];
const DOWNLOAD_BYTES = [10, 20, 30, 40, 50];
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
  const aioState = {
    steps: { detectText: true },
    stageSelection: { detectText: 'auto' },
    presetState: { presetId: 'preset-1' },
    maskDilation: 4,
    hdStrategy: 'resize',
    hdResizeLimit: 2048,
    hdCropMargin: 16,
    hdCropTriggerSize: 4096,
    detectionsByImage: {},
    selectedRegionByImage: { 'img-1': 'region-1' },
    pipelineSnapshots: [],
    pipelineSnapshotIndex: 0,
    imageSnapshotIndexById: {},
    autoHistoryAvailable: true,
    autoProcessedImageById: {},
    manualQuotaChargedByImage: {},
    manualProgressByImage: {},
    manualImageEditsByImage: {},
  };
  const cleanerState = {
    detectionsByImage: {},
    selectedRegionByImage: {},
    runMetaByImage: {},
    processedBaseByImage: { 'img-1': DATA_URL_PNG_HEADER },
    manualImageEditsByImage: {},
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

describe('workspace signature builders', () => {
  it('is deterministic for the same state instance', () => {
    const state = buildCaptureState();

    const historyFirst = buildWorkspaceHistorySignature(state);
    const historySecond = buildWorkspaceHistorySignature(state);
    const autosaveFirst = buildWorkspaceAutosaveSignature(state);
    const autosaveSecond = buildWorkspaceAutosaveSignature(state);

    expect(typeof historyFirst).toBe('string');
    expect(historyFirst.length).toBeGreaterThan(0);
    expect(historyFirst).toBe(historySecond);
    expect(autosaveFirst).toBe(autosaveSecond);
  });

  it('is identical for fresh states with equal binary metadata', () => {
    // Files and Blobs are replaced by {name,size,type,lastModified} metadata,
    // so freshly built equal states must produce equal signature strings.
    const first = buildCaptureState();
    const second = buildCaptureState();

    expect(buildWorkspaceHistorySignature(first)).toBe(
      buildWorkspaceHistorySignature(second),
    );
    expect(buildWorkspaceAutosaveSignature(first)).toBe(
      buildWorkspaceAutosaveSignature(second),
    );
  });

  it('changes when binary content metadata changes', () => {
    const first = buildCaptureState();
    const second = buildCaptureState();
    const secondImage = requireValue(second.images[0], 'second image');
    second.images[0] = {
      ...secondImage,
      file: new File([new Uint8Array([1, 2, 3])], 'cover-page.png', {
        type: 'image/png',
        lastModified: 1700000000000,
      }),
    };

    expect(buildWorkspaceHistorySignature(first)).not.toBe(
      buildWorkspaceHistorySignature(second),
    );
  });

  it('drops explicitly-undefined keys from the signature (undefined-key dropping)', () => {
    const resultWithoutPreviewUrl = (source: OptimizationResult): OptimizationResult => ({
      sourceImageId: source.sourceImageId,
      fileName: source.fileName,
      blob: source.blob,
      originalBytes: source.originalBytes,
      optimizedBytes: source.optimizedBytes,
      width: source.width,
      height: source.height,
    });

    const withKey = buildCaptureState();
    const withExplicitUndefined = buildCaptureState();
    const undefinedSource = requireValue(
      withExplicitUndefined.utility.optimizer.results[0],
      'optimizer result',
    );
    withExplicitUndefined.utility.optimizer.results = [
      {
        ...resultWithoutPreviewUrl(undefinedSource),
        previewUrl: undefined,
      },
    ];
    // A present previewUrl participates in the signature...
    expect(buildWorkspaceHistorySignature(withKey)).not.toBe(
      buildWorkspaceHistorySignature(withExplicitUndefined),
    );

    // ...while an explicitly-undefined key normalizes away like an absent key.
    const withoutKey = buildCaptureState();
    const absentSource = requireValue(
      withoutKey.utility.optimizer.results[0],
      'optimizer result',
    );
    withoutKey.utility.optimizer.results = [
      resultWithoutPreviewUrl(absentSource),
    ];
    expect(buildWorkspaceHistorySignature(withoutKey)).toBe(
      buildWorkspaceHistorySignature(withExplicitUndefined),
    );

    const withDifferentUrl = buildCaptureState();
    const changedSource = requireValue(
      withDifferentUrl.utility.optimizer.results[0],
      'optimizer result',
    );
    withDifferentUrl.utility.optimizer.results = [
      {
        ...resultWithoutPreviewUrl(changedSource),
        previewUrl: 'blob:changed-preview',
      },
    ];
    expect(buildWorkspaceHistorySignature(withoutKey)).not.toBe(
      buildWorkspaceHistorySignature(withDifferentUrl),
    );
  });

  it('excludes watermark result previewUrl from the signature', () => {
    const first = buildCaptureState();
    const second = buildCaptureState();
    const secondResult = requireValue(
      second.utility.watermark.results[0],
      'watermark result',
    );
    second.utility.watermark.results = [
      { ...secondResult, previewUrl: 'blob:other-preview' },
    ];

    expect(buildWorkspaceHistorySignature(first)).toBe(
      buildWorkspaceHistorySignature(second),
    );
  });

  it('scopes history to content and autosave to content plus view fields', () => {
    const base = buildCaptureState();

    const modeChanged: DashboardWorkspaceCaptureState = { ...base, mode: 'translator' };
    expect(buildWorkspaceHistorySignature(base)).toBe(
      buildWorkspaceHistorySignature(modeChanged),
    );
    expect(buildWorkspaceAutosaveSignature(base)).not.toBe(
      buildWorkspaceAutosaveSignature(modeChanged),
    );

    const scopeChanged: DashboardWorkspaceCaptureState = {
      ...base,
      autosaveScope: 'user',
    };
    expect(buildWorkspaceHistorySignature(base)).toBe(
      buildWorkspaceHistorySignature(scopeChanged),
    );
    expect(buildWorkspaceAutosaveSignature(base)).not.toBe(
      buildWorkspaceAutosaveSignature(scopeChanged),
    );

    const statusChanged: DashboardWorkspaceCaptureState = {
      ...base,
      statusMessage: 'Something else',
      lastActionScope: 'translator',
    };
    expect(buildWorkspaceHistorySignature(base)).toBe(
      buildWorkspaceHistorySignature(statusChanged),
    );
    expect(buildWorkspaceAutosaveSignature(base)).toBe(
      buildWorkspaceAutosaveSignature(statusChanged),
    );
  });

  it('collapses data urls by length and head/tail slices', () => {
    const first = buildCaptureState();
    const second = buildCaptureState();
    // Same length, same first/last 48 chars, different middle bytes.
    first.cleaner.processedBaseByImage = {
      'img-1': `data:image/png;base64,${'A'.repeat(60)}M${'B'.repeat(59)}`,
    };
    second.cleaner.processedBaseByImage = {
      'img-1': `data:image/png;base64,${'A'.repeat(60)}N${'B'.repeat(59)}`,
    };

    expect(buildWorkspaceHistorySignature(first)).toBe(
      buildWorkspaceHistorySignature(second),
    );
  });
});
