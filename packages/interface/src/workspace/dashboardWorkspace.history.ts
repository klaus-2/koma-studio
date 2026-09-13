import type {
  AioDownloadEntry,
  AioManualImageProgress,
  AioManualImageEditState,
  AioPipelineSnapshot,
  CleanerRunMeta,
  DownloadItem,
  AioTextRegion,
  TranslatorVisualRunMeta,
} from "../types/dashboard.types";
import { cloneTypographyRegions, type TypographySession } from "../typography/types";
import { WORKSPACE_DOCUMENT_VERSION } from "../../../../packages/types/src/workspace";
import type {
  DashboardWorkspaceCaptureState,
  DashboardWorkspaceHistorySnapshot,
  DashboardWorkspaceRestoreState,
  HistoryAioDownloadEntry,
  HistoryBlobHandle,
  HistoryDataUrlHandle,
  HistoryManualImageEditState,
  OptimizerWorkspaceRuntimeState,
} from "./dashboardWorkspace";

type RuntimeAioState = DashboardWorkspaceCaptureState["aio"] & {
  detectionsByImage: Record<string, AioTextRegion[]>;
  pipelineSnapshots: AioPipelineSnapshot[];
  manualProgressByImage: Record<string, AioManualImageProgress>;
  manualImageEditsByImage: Record<string, AioManualImageEditState>;
};

type RuntimeCleanerState = DashboardWorkspaceCaptureState["cleaner"] & {
  detectionsByImage: Record<string, AioTextRegion[]>;
  runMetaByImage: Record<string, CleanerRunMeta>;
  manualImageEditsByImage: Record<string, AioManualImageEditState>;
};

type RuntimeTranslatorState = DashboardWorkspaceCaptureState["translator"] & {
  translatorDetectionsByImage: Record<string, AioTextRegion[]>;
  translatorRunMetaByImage: Record<string, TranslatorVisualRunMeta>;
  translatorProcessedBaseByImage: Record<string, string>;
};

type HistoryAssetEntry =
  | {
      kind: "blob";
      value: Blob;
      refCount: number;
    }
  | {
      kind: "data-url";
      value: string;
      refCount: number;
    };

const historyAssetPool = new Map<string, HistoryAssetEntry>();
// LRU ordering: re-insert on access to keep recently-used entries at the end.
const historyAssetAccessOrder: string[] = [];
// Max pool size: 200 MB total estimated. Data URLs are ~1.33x binary, blobs are 1:1.
const historyBlobAssetIds = new WeakMap<Blob, string>();
const historyDataUrlAssetIds = new Map<string, string>();

const createHistoryAssetId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `history-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const retainHistoryBlob = (blob: Blob): HistoryBlobHandle => {
  let assetId = historyBlobAssetIds.get(blob);
  if (!assetId) {
    assetId = createHistoryAssetId();
    historyBlobAssetIds.set(blob, assetId);
  }

  const existing = historyAssetPool.get(assetId);
  if (existing && existing.kind !== "blob") {
    throw new Error("Internal conflict while retaining the history blob.");
  }

  if (existing) {
    existing.refCount += 1;
    const idx = historyAssetAccessOrder.indexOf(assetId);
    if (idx !== -1) {
      historyAssetAccessOrder.splice(idx, 1);
      historyAssetAccessOrder.push(assetId);
    }
  } else {
    historyAssetPool.set(assetId, {
      kind: "blob",
      value: blob,
      refCount: 1,
    });
    historyAssetAccessOrder.push(assetId);
  }

  return {
    __historyKind: "blob",
    assetId,
    type: blob.type || "application/octet-stream",
    size: blob.size,
  };
};

const resolveHistoryBlob = (handle: HistoryBlobHandle): Blob => {
  const entry = historyAssetPool.get(handle.assetId);
  if (!entry || entry.kind !== "blob") {
    throw new Error(
      "The binary history asset is no longer available for restoration.",
    );
  }
  return entry.value;
};

const releaseHistoryBlob = (handle: HistoryBlobHandle): void => {
  const entry = historyAssetPool.get(handle.assetId);
  if (!entry || entry.kind !== "blob") {
    return;
  }
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    historyAssetPool.delete(handle.assetId);
    const idx = historyAssetAccessOrder.indexOf(handle.assetId);
    if (idx !== -1) historyAssetAccessOrder.splice(idx, 1);
  }
};

const retainHistoryDataUrl = (
  dataUrl: string | null | undefined,
): HistoryDataUrlHandle | null => {
  if (!dataUrl) return null;

  let assetId = historyDataUrlAssetIds.get(dataUrl);
  if (!assetId) {
    assetId = createHistoryAssetId();
    historyDataUrlAssetIds.set(dataUrl, assetId);
  }

  const existing = historyAssetPool.get(assetId);
  if (existing && existing.kind !== "data-url") {
    throw new Error("Internal conflict while retaining the history data URL.");
  }

  if (existing) {
    existing.refCount += 1;
    const idx = historyAssetAccessOrder.indexOf(assetId);
    if (idx !== -1) {
      historyAssetAccessOrder.splice(idx, 1);
      historyAssetAccessOrder.push(assetId);
    }
  } else {
    historyAssetPool.set(assetId, {
      kind: "data-url",
      value: dataUrl,
      refCount: 1,
    });
    historyAssetAccessOrder.push(assetId);
  }

  return {
    __historyKind: "data-url",
    assetId,
    length: dataUrl.length,
  };
};

const resolveHistoryDataUrl = (
  handle: HistoryDataUrlHandle | null | undefined,
): string | null => {
  if (!handle) return null;
  const entry = historyAssetPool.get(handle.assetId);
  if (!entry || entry.kind !== "data-url") {
    throw new Error(
      "The image history asset is no longer available for restoration.",
    );
  }
  return entry.value;
};

const releaseHistoryDataUrl = (
  handle: HistoryDataUrlHandle | null | undefined,
): void => {
  if (!handle) return;
  const entry = historyAssetPool.get(handle.assetId);
  if (!entry || entry.kind !== "data-url") {
    return;
  }
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    historyAssetPool.delete(handle.assetId);
    historyDataUrlAssetIds.delete(entry.value);
  }
};

const cloneTypographyQueueForHistory = (
  queue: TypographySession["queue"],
): TypographySession["queue"] => queue.map((item) => ({ ...item }));

const cloneTypographySnapshotForHistory = (
  snapshot: TypographySession["snapshots"][number],
): TypographySession["snapshots"][number] => ({
  ...snapshot,
  queue: cloneTypographyQueueForHistory(snapshot.queue),
  defaults: { ...snapshot.defaults },
  regions: cloneTypographyRegions(snapshot.regions),
});

const cloneTypographySessionForHistory = (
  session: TypographySession,
): TypographySession => ({
  ...session,
  queue: cloneTypographyQueueForHistory(session.queue),
  defaults: { ...session.defaults },
  snapshots: session.snapshots.map((snapshot) =>
    cloneTypographySnapshotForHistory(snapshot),
  ),
});

const cloneTypographySessionsMapForHistory = (
  sessionsByImage: Record<string, TypographySession>,
): Record<string, TypographySession> =>
  Object.fromEntries(
    Object.entries(sessionsByImage).map(([imageId, session]) => [
      imageId,
      cloneTypographySessionForHistory(session),
    ]),
  );

const cloneRegionMapForHistory = (
  value: Record<string, AioTextRegion[]>,
): Record<string, AioTextRegion[]> =>
  Object.fromEntries(
    Object.entries(value).map(([imageId, regions]) => [
      imageId,
      cloneTypographyRegions(regions) as AioTextRegion[],
    ]),
  );

const cloneSelectedRegionMapForHistory = (
  value: Record<string, string | null>,
): Record<string, string | null> => ({ ...value });

const cloneStringMapForHistory = (
  value: Record<string, string>,
): Record<string, HistoryDataUrlHandle> =>
  Object.fromEntries(
    Object.entries(value).flatMap(([imageId, dataUrl]) => {
      const retained = retainHistoryDataUrl(dataUrl);
      return retained ? [[imageId, retained] as const] : [];
    }),
  );

const cloneManualImageEditMapForHistory = (
  value: Record<string, AioManualImageEditState>,
): Record<string, HistoryManualImageEditState> =>
  Object.fromEntries(
    Object.entries(value).map(([imageId, editState]) => [
      imageId,
      {
        paintLayerDataUrl: retainHistoryDataUrl(editState.paintLayerDataUrl),
        baseImageDataUrl: retainHistoryDataUrl(editState.baseImageDataUrl),
        wandMaskDataUrl: retainHistoryDataUrl(editState.wandMaskDataUrl),
      },
    ]),
  );

const cloneAioDownloadEntriesForHistory = (
  entries: AioDownloadEntry[],
): HistoryAioDownloadEntry[] =>
  entries.map((entry) => ({
    fileName: entry.fileName,
    blob: retainHistoryBlob(entry.blob),
    sourceImageId: entry.sourceImageId,
  }));

const cloneAioManualProgressMapForHistory = (
  value: DashboardWorkspaceCaptureState["aio"]["manualProgressByImage"],
): DashboardWorkspaceCaptureState["aio"]["manualProgressByImage"] =>
  Object.fromEntries(
    Object.entries(value as Record<string, AioManualImageProgress>).map(([imageId, progress]) => [
      imageId,
      {
        ...progress,
        statusByStage: { ...progress.statusByStage },
      },
    ]),
  );

const cloneRunMetaMapForHistory = <
  TValue extends CleanerRunMeta | TranslatorVisualRunMeta,
>(
  value: Record<string, TValue>,
): Record<string, TValue> =>
  Object.fromEntries(
    Object.entries(value).map(([imageId, meta]) => [imageId, { ...meta }]),
  ) as Record<string, TValue>;

const clonePipelineSnapshotsForHistory = (
  snapshots: AioPipelineSnapshot[],
): DashboardWorkspaceHistorySnapshot["aio"]["pipelineSnapshots"] =>
  snapshots.map((snapshot) => ({
    ...snapshot,
    detectionsByImage: cloneRegionMapForHistory(snapshot.detectionsByImage),
    selectedRegionByImage: cloneSelectedRegionMapForHistory(
      snapshot.selectedRegionByImage,
    ),
    aioDownloads: cloneAioDownloadEntriesForHistory(snapshot.aioDownloads),
  }));

const cloneAioStateForHistory = (
  value: DashboardWorkspaceCaptureState["aio"],
): DashboardWorkspaceHistorySnapshot["aio"] => {
  const runtimeValue = value as RuntimeAioState;
  return {
    steps: { ...runtimeValue.steps },
    stageSelection: { ...runtimeValue.stageSelection },
    presetState: toJsonClone(runtimeValue.presetState),
    maskDilation: runtimeValue.maskDilation,
    hdStrategy: runtimeValue.hdStrategy,
    hdResizeLimit: runtimeValue.hdResizeLimit,
    hdCropMargin: runtimeValue.hdCropMargin,
    hdCropTriggerSize: runtimeValue.hdCropTriggerSize,
    detectionsByImage: cloneRegionMapForHistory(runtimeValue.detectionsByImage),
    selectedRegionByImage: cloneSelectedRegionMapForHistory(
      runtimeValue.selectedRegionByImage,
    ),
    pipelineSnapshots: clonePipelineSnapshotsForHistory(runtimeValue.pipelineSnapshots),
    pipelineSnapshotIndex: runtimeValue.pipelineSnapshotIndex,
    imageSnapshotIndexById: { ...runtimeValue.imageSnapshotIndexById },
    autoHistoryAvailable: runtimeValue.autoHistoryAvailable,
    autoProcessedImageById: { ...runtimeValue.autoProcessedImageById },
    // v2 does not charge manual quota (unified-contract field used by v1)
    manualQuotaChargedByImage: {},
    manualProgressByImage: cloneAioManualProgressMapForHistory(
      runtimeValue.manualProgressByImage,
    ),
    manualImageEditsByImage: cloneManualImageEditMapForHistory(
      runtimeValue.manualImageEditsByImage,
    ),
  };
};

const cloneCleanerStateForHistory = (
  value: DashboardWorkspaceCaptureState["cleaner"],
): DashboardWorkspaceHistorySnapshot["cleaner"] => {
  const runtimeValue = value as RuntimeCleanerState;
  return {
    detectionsByImage: cloneRegionMapForHistory(runtimeValue.detectionsByImage),
    selectedRegionByImage: cloneSelectedRegionMapForHistory(
      runtimeValue.selectedRegionByImage,
    ),
    processedBaseByImage: cloneStringMapForHistory(runtimeValue.processedBaseByImage),
    runMetaByImage: cloneRunMetaMapForHistory(runtimeValue.runMetaByImage),
    manualImageEditsByImage: cloneManualImageEditMapForHistory(
      runtimeValue.manualImageEditsByImage,
    ),
  };
};

const cloneTranslatorStateForHistory = (
  value: DashboardWorkspaceCaptureState["translator"],
): DashboardWorkspaceHistorySnapshot["translator"] => {
  const runtimeValue = value as RuntimeTranslatorState;
  return {
    srcLang: runtimeValue.srcLang,
    tgtLang: runtimeValue.tgtLang,
    aioSrcLang: runtimeValue.aioSrcLang,
    aioTgtLang: runtimeValue.aioTgtLang,
    translatorDraftText: runtimeValue.translatorDraftText,
    translatorTranslatedText: runtimeValue.translatorTranslatedText,
    translatorLastTextModelUsed: runtimeValue.translatorLastTextModelUsed,
    translatorTextDirty: runtimeValue.translatorTextDirty,
    translatorDetectionsByImage: cloneRegionMapForHistory(
      runtimeValue.translatorDetectionsByImage,
    ),
    translatorSelectedRegionByImage: cloneSelectedRegionMapForHistory(
      runtimeValue.translatorSelectedRegionByImage,
    ),
    translatorRunMetaByImage: cloneRunMetaMapForHistory(
      runtimeValue.translatorRunMetaByImage,
    ),
    translatorProcessedBaseByImage: cloneStringMapForHistory(
      runtimeValue.translatorProcessedBaseByImage,
    ),
  } as unknown as DashboardWorkspaceHistorySnapshot["translator"];
};

const toJsonClone = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to the JSON-safe clone path below.
    }
  }

  return JSON.parse(JSON.stringify(value, (_key, entry) => {
    if (typeof entry === "function") {
      return undefined;
    }
    if (typeof window !== "undefined" && entry === window) {
      return undefined;
    }
    return entry;
  })) as T;
};

export const captureWorkspaceHistorySnapshot = (
  state: DashboardWorkspaceCaptureState,
): DashboardWorkspaceHistorySnapshot => ({
  mode: state.mode,
  subMode: state.subMode,
  activeImageId: state.activeImageId,
  viewMode: state.viewMode,
  translatorWorkspaceMode: state.translatorWorkspaceMode,
  translatorVisualProcessingMode: state.translatorVisualProcessingMode,
  statusMessage: state.statusMessage,
  lastActionScope: state.lastActionScope,
  images: state.images.map((item) => ({
    id: item.id,
    file: item.file,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    filters: toJsonClone(item.filters),
  })),
  downloadItems: state.downloadItems.map((item) => ({
    name: item.name,
    blob: retainHistoryBlob(item.blob),
    scope: item.scope,
    sourceImageId: item.sourceImageId,
  })),
  batchThreadsEnabled: state.batchThreadsEnabled,
  batchThreads: state.batchThreads,
  aio: cloneAioStateForHistory(state.aio),
  cleaner: cloneCleanerStateForHistory(state.cleaner),
  translator: cloneTranslatorStateForHistory(state.translator),
  typesetter: {
    ...state.typesetter,
    sessionsByImage: cloneTypographySessionsMapForHistory(
      state.typesetter.sessionsByImage,
    ),
  },
  enhance: toJsonClone(state.enhance),
  utility: {
    stitch: toJsonClone(state.utility.stitch),
    splitter: toJsonClone(state.utility.splitter),
    watermark: {
      ...toJsonClone(state.utility.watermark),
      watermarkImageFile: state.utility.watermark.watermarkImageFile,
      results: state.utility.watermark.results.map((item) => ({
        sourceImageId: item.sourceImageId,
        name: item.name,
        blob: retainHistoryBlob(item.blob),
        previewUrl: "",
        resolvedAnchor: item.resolvedAnchor,
      })),
    },
    optimizer: {
      ...toJsonClone(state.utility.optimizer),
      results: state.utility.optimizer.results.map((item) => ({
        sourceImageId: item.sourceImageId,
        fileName: item.fileName,
        blob: retainHistoryBlob(item.blob),
        originalBytes: item.originalBytes,
        optimizedBytes: item.optimizedBytes,
        width: item.width,
        height: item.height,
      })),
    },
  },
  llm: toJsonClone(state.llm),
});

export const restoreWorkspaceHistorySnapshot = async (
  snapshot: DashboardWorkspaceHistorySnapshot,
): Promise<DashboardWorkspaceRestoreState> => {
  // Restored object URLs are owned by the live collections they are restored
  // into and are revoked when the corresponding entry is replaced or removed
  // (revokeLoadedImageUrls / registerDownloads / watermark revokeEntries).
  const restoredImages: DashboardWorkspaceRestoreState["images"] = [];
  for (const item of snapshot.images) {
    const url = URL.createObjectURL(item.file);
    restoredImages.push({
      id: item.id,
      file: item.file,
      url,
      width: item.width,
      height: item.height,
      rotation: item.rotation,
      filters: toJsonClone(item.filters),
    });
  }

  const restoredDownloadItems: DashboardWorkspaceRestoreState["downloadItems"] = [];
  for (const item of snapshot.downloadItems) {
    const blob = resolveHistoryBlob(item.blob);
    const previewUrl = URL.createObjectURL(blob);
    restoredDownloadItems.push({
      name: item.name,
      blob,
      scope: item.scope as DownloadItem["scope"],
      sourceImageId: item.sourceImageId,
      previewUrl,
    });
  }

  const restoredWatermarkResults: DashboardWorkspaceRestoreState["utility"]["watermark"]["results"] = [];
  for (const item of snapshot.utility.watermark.results) {
    const blob = resolveHistoryBlob(item.blob);
    restoredWatermarkResults.push({
      ...item,
      blob,
      previewUrl: URL.createObjectURL(blob),
    });
  }

  return ({
  document: {
    version: WORKSPACE_DOCUMENT_VERSION,
    savedAt: new Date().toISOString(),
    autosaveScope: "guest",
    autosaveUserId: null,
    view: {
      mode: snapshot.mode,
      subMode: snapshot.subMode,
      activeImageId: snapshot.activeImageId,
      viewMode: snapshot.viewMode,
      translatorWorkspaceMode: snapshot.translatorWorkspaceMode,
      translatorVisualProcessingMode: snapshot.translatorVisualProcessingMode,
    },
    footer: {
      lastActionScope: snapshot.lastActionScope,
      statusMessage: snapshot.statusMessage,
    },
    images: [],
    downloadItems: [],
    batchThreadsEnabled: snapshot.batchThreadsEnabled,
    batchThreads: snapshot.batchThreads,
    aio: snapshot.aio as unknown as DashboardWorkspaceRestoreState["document"]["aio"],
    cleaner: {
      detectionsByImage: snapshot.cleaner.detectionsByImage,
      selectedRegionByImage: snapshot.cleaner.selectedRegionByImage,
      processedBaseAssetByImage: {},
      runMetaByImage: snapshot.cleaner.runMetaByImage,
      manualImageEditsByImage: {},
    } as unknown as DashboardWorkspaceRestoreState["document"]["cleaner"],
    translator: {
      ...snapshot.translator,
      translatorProcessedBaseAssetByImage: {},
    } as unknown as DashboardWorkspaceRestoreState["document"]["translator"],
    typesetter: {
      selectionTool: snapshot.typesetter.selectionTool,
      queueSelectedId: snapshot.typesetter.queueSelectedId,
      snapshotName: snapshot.typesetter.snapshotName,
      selectedSnapshotId: snapshot.typesetter.selectedSnapshotId,
      sessionsByImage: snapshot.typesetter.sessionsByImage,
    },
    enhance: snapshot.enhance,
    utility: {
      stitch: snapshot.utility.stitch,
      splitter: {
        recipe: snapshot.utility.splitter.recipe,
        imageStates: snapshot.utility.splitter.imageStates,
        activeImageId: snapshot.utility.splitter.activeImageId,
      },
      watermark: {
        draft: snapshot.utility.watermark.draft,
        activeImageId: snapshot.utility.watermark.activeImageId,
        compareMode: snapshot.utility.watermark.compareMode,
        compareValue: snapshot.utility.watermark.compareValue,
        selectedPresetId: snapshot.utility.watermark.selectedPresetId,
        autoSuggestion: snapshot.utility.watermark.autoSuggestion,
        userPresets: snapshot.utility.watermark.userPresets,
        watermarkImage: null,
        results: [],
      },
      optimizer: {
        recipe: snapshot.utility.optimizer.recipe,
        selectedPreset: snapshot.utility.optimizer.selectedPreset,
        activeImageId: snapshot.utility.optimizer.activeImageId,
        results: [],
      },
    },
    llm: snapshot.llm,
  },
  images: restoredImages,
  downloadItems: restoredDownloadItems,
  aio: {
    ...toJsonClone(snapshot.aio),
    pipelineSnapshots: snapshot.aio.pipelineSnapshots.map((pipelineSnapshot) => ({
      ...toJsonClone(pipelineSnapshot),
      aioDownloads: pipelineSnapshot.aioDownloads.map((entry) => ({
        fileName: entry.fileName,
        blob: resolveHistoryBlob(entry.blob),
        sourceImageId: entry.sourceImageId,
      })),
    })),
    manualImageEditsByImage: Object.fromEntries(
      Object.entries(snapshot.aio.manualImageEditsByImage).map(
        ([imageId, editState]) => [
          imageId,
          {
            paintLayerDataUrl: resolveHistoryDataUrl(
              editState.paintLayerDataUrl,
            ),
            baseImageDataUrl: resolveHistoryDataUrl(editState.baseImageDataUrl),
            wandMaskDataUrl: resolveHistoryDataUrl(editState.wandMaskDataUrl),
          },
        ],
      ),
    ),
  } as unknown as DashboardWorkspaceRestoreState["aio"],
  cleaner: {
    ...toJsonClone(snapshot.cleaner),
    processedBaseByImage: Object.fromEntries(
      Object.entries(snapshot.cleaner.processedBaseByImage).map(
        ([imageId, handle]) => [imageId, resolveHistoryDataUrl(handle) ?? ""],
      ),
    ),
    manualImageEditsByImage: Object.fromEntries(
      Object.entries(snapshot.cleaner.manualImageEditsByImage).map(
        ([imageId, editState]) => [
          imageId,
          {
            paintLayerDataUrl: resolveHistoryDataUrl(
              editState.paintLayerDataUrl,
            ),
            baseImageDataUrl: resolveHistoryDataUrl(editState.baseImageDataUrl),
            wandMaskDataUrl: resolveHistoryDataUrl(editState.wandMaskDataUrl),
          },
        ],
      ),
    ),
  } as unknown as DashboardWorkspaceRestoreState["cleaner"],
  translator: {
    ...toJsonClone(snapshot.translator),
    translatorProcessedBaseByImage: Object.fromEntries(
      Object.entries(snapshot.translator.translatorProcessedBaseByImage as unknown as Record<string, HistoryDataUrlHandle>).map(
        ([imageId, handle]) => [imageId, resolveHistoryDataUrl(handle) ?? ""],
      ),
    ),
  },
  typesetter: toJsonClone(snapshot.typesetter),
  utility: {
    splitter: toJsonClone(snapshot.utility.splitter),
    watermark: {
      ...toJsonClone(snapshot.utility.watermark),
      watermarkImageFile: snapshot.utility.watermark.watermarkImageFile,
      results: restoredWatermarkResults,
    },
    optimizer: {
      ...toJsonClone(snapshot.utility.optimizer),
      results: snapshot.utility.optimizer.results.map((item) => ({
        ...item,
        blob: resolveHistoryBlob(item.blob),
      })) as OptimizerWorkspaceRuntimeState["results"],
    },
  },
  });
};

export const releaseWorkspaceHistorySnapshot = (
  snapshot: DashboardWorkspaceHistorySnapshot,
): void => {
  snapshot.downloadItems.forEach((item) => {
    releaseHistoryBlob(item.blob);
  });

  Object.values(snapshot.aio.manualImageEditsByImage).forEach((editState) => {
    releaseHistoryDataUrl(editState.paintLayerDataUrl);
    releaseHistoryDataUrl(editState.baseImageDataUrl);
    releaseHistoryDataUrl(editState.wandMaskDataUrl);
  });

  snapshot.aio.pipelineSnapshots.forEach((pipelineSnapshot) => {
    pipelineSnapshot.aioDownloads.forEach((entry) => {
      releaseHistoryBlob(entry.blob);
    });
  });

  Object.values(snapshot.cleaner.processedBaseByImage).forEach((handle) => {
    releaseHistoryDataUrl(handle);
  });

  Object.values(snapshot.translator.translatorProcessedBaseByImage as unknown as Record<string, HistoryDataUrlHandle>).forEach(
    (handle) => {
      releaseHistoryDataUrl(handle);
    },
  );

  Object.values(snapshot.cleaner.manualImageEditsByImage).forEach(
    (editState) => {
      releaseHistoryDataUrl(editState.paintLayerDataUrl);
      releaseHistoryDataUrl(editState.baseImageDataUrl);
      releaseHistoryDataUrl(editState.wandMaskDataUrl);
    },
  );

  snapshot.utility.watermark.results.forEach((item) => {
    releaseHistoryBlob(item.blob);
  });

  snapshot.utility.optimizer.results.forEach((item) => {
    releaseHistoryBlob(item.blob);
  });
};
