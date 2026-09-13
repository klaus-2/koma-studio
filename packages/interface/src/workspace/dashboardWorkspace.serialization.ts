import type {
  WorkspaceAioDownloadEntryDocument,
  WorkspaceAioPipelineSnapshotDocument,
  WorkspaceBinaryAssetPayload,
  WorkspaceDownloadItemDocument,
  WorkspaceDocumentV1,
  WorkspaceExportPayload,
  WorkspaceLoadedImageDocument,
  WorkspaceManualImageEditDocument,
  WorkspacePackageManifestV1,
  WorkspacePackagePayload,
  WorkspaceUtilityStateDocument,
  WorkspaceWatermarkResultDocument,
  WorkspaceOptimizerResultDocument,
} from "../../../../packages/types/src/workspace";
import {
  WORKSPACE_DOCUMENT_VERSION,
  WORKSPACE_FILE_EXTENSION,
} from "../../../../packages/types/src/workspace";
import type {
  AioDownloadEntry,
  AioManualImageEditState,
  AioPipelineSnapshot,
  DownloadItem,
  ImageFilters,
  LoadedImage,
} from "../types/dashboard.types";
import type { OptimizationResult } from "../types";
import type { TypographySession } from "../typography/types";
import type {
  DashboardWorkspaceCaptureState,
  DashboardWorkspaceRestoreState,
  OptimizerWorkspaceRuntimeState,
  WatermarkWorkspaceRuntimeState,
} from "./dashboardWorkspace";
import { blobToDataUrl, dataUrlToBlob } from "../utils/dashboard.utils";

interface WorkspaceAssetSourceLike {
  fileName: string;
  mimeType: string;
  toBuffer: () => Promise<ArrayBuffer>;
}

type WorkspaceWatermarkDocumentWithTextZoneCache = WorkspaceUtilityStateDocument["watermark"] & {
  textZoneCache?: WatermarkWorkspaceRuntimeState["textZoneCache"];
};

const buildWorkspaceDownloadLookupKey = (
  sourceImageId: string,
  fileName: string,
): string => `${sourceImageId}::${fileName}`;

const cloneArrayBufferLike = (value: unknown): ArrayBuffer | null => {
  if (value instanceof ArrayBuffer) {
    return value.slice(0);
  }
  if (ArrayBuffer.isView(value)) {
    if (value.buffer instanceof ArrayBuffer) {
      return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    }
    return null;
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return Uint8Array.from(value).buffer;
  }
  if (value && typeof value === "object") {
    const data = (value as { data?: unknown }).data;
    if (Array.isArray(data) && data.every((item) => typeof item === "number")) {
      return Uint8Array.from(data).buffer;
    }
  }
  return null;
};

const resolveWorkspaceBinaryBuffer = async (value: unknown): Promise<ArrayBuffer> => {
  const directBuffer = cloneArrayBufferLike(value);
  if (directBuffer) {
    return directBuffer;
  }

  if (
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
  ) {
    const result = await (value as { arrayBuffer: () => Promise<unknown> }).arrayBuffer();
    const resolvedBuffer = cloneArrayBufferLike(result);
    if (resolvedBuffer) {
      return resolvedBuffer;
    }
  }

  if (value && typeof value === "object" && "buffer" in value) {
    const resolvedBuffer = cloneArrayBufferLike(
      (value as { buffer?: unknown }).buffer,
    );
    if (resolvedBuffer) {
      return resolvedBuffer;
    }
  }

  throw new Error("The workspace contains an invalid binary that cannot be saved locally.");
};

const fetchWorkspaceBinaryFromUrl = async (
  sourceUrl: string,
  fileLabel: string,
): Promise<ArrayBuffer> => {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to rebuild the workspace binary for "${fileLabel}".`);
  }
  return response.arrayBuffer();
};

const toJsonClone = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to the JSON-safe clone path below.
    }
  }

  return JSON.parse(
    JSON.stringify(value, (_key, entry) => {
      if (typeof entry === "function") {
        return undefined;
      }
      if (typeof window !== "undefined" && entry === window) {
        return undefined;
      }
      return entry;
    }),
  ) as T;
};

const createWorkspaceAssetId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `workspace-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const guessExtensionFromMimeType = (mimeType: string): string => {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/png") return "png";
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/webp") return "webp";
  if (normalized === "application/json") return "json";
  if (normalized === "text/plain") return "txt";
  if (normalized === "application/pdf") return "pdf";
  if (normalized === "application/zip") return "zip";
  return "bin";
};

const sanitizeAssetFileName = (fileName: string): string =>
  fileName.replace(/[^\w.-]+/g, "-");

class WorkspaceAssetCollector {
  private readonly assets: WorkspaceBinaryAssetPayload[] = [];

  async add(
    namespace: string,
    source: WorkspaceAssetSourceLike,
  ): Promise<{ assetId: string }> {
    const assetId = createWorkspaceAssetId();
    const fallbackExtension = guessExtensionFromMimeType(source.mimeType);
    const hasExtension = /\.[a-z0-9]+$/i.test(source.fileName);
    const safeFileName = sanitizeAssetFileName(
      hasExtension ? source.fileName : `${source.fileName}.${fallbackExtension}`,
    );
    const path = `assets/${namespace}/${assetId}-${safeFileName}`;
    let buffer: ArrayBuffer;
    try {
      buffer = await source.toBuffer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown failure while reading the binary.";
      throw new Error(
        `The workspace contains an invalid binary that cannot be saved locally (${namespace}/${safeFileName}): ${message}`,
      );
    }
    this.assets.push({
      id: assetId,
      path,
      fileName: safeFileName,
      mimeType: source.mimeType,
      buffer,
    });
    return { assetId };
  }

  async addBlob(
    namespace: string,
    fileName: string,
    blob: Blob | File | ArrayBuffer | ArrayBufferView | { type?: string; buffer?: unknown; arrayBuffer?: () => Promise<unknown> },
  ): Promise<{ assetId: string }> {
    return this.add(namespace, {
      fileName,
      mimeType:
        (typeof blob === "object" && blob && "type" in blob && typeof blob.type === "string"
          ? blob.type
          : "") || "application/octet-stream",
      toBuffer: async () => resolveWorkspaceBinaryBuffer(blob),
    });
  }

  async addFile(
    namespace: string,
    file: File,
  ): Promise<{ assetId: string }> {
    return this.add(namespace, {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      toBuffer: async () => file.arrayBuffer(),
    });
  }

  async addDataUrl(
    namespace: string,
    fileName: string,
    dataUrl: string | null | undefined,
  ): Promise<{ assetId: string } | null> {
    if (!dataUrl) return null;
    const blob = await dataUrlToBlob(dataUrl);
    return this.addBlob(namespace, fileName, blob);
  }

  getAssets(): WorkspaceBinaryAssetPayload[] {
    return this.assets.map((asset) => ({
      ...asset,
      buffer: asset.buffer.slice(0),
    }));
  }
}

const toLoadedImageDocument = async (
  collector: WorkspaceAssetCollector,
  image: LoadedImage,
): Promise<WorkspaceLoadedImageDocument> => {
  const source = await (async () => {
    try {
      return await collector.addFile("images", image.file);
    } catch {
      return collector.add("images", {
        fileName: image.file.name,
        mimeType: image.file.type || "application/octet-stream",
        toBuffer: async () => fetchWorkspaceBinaryFromUrl(image.url, image.file.name),
      });
    }
  })();
  return {
    id: image.id,
    fileName: image.file.name,
    mimeType: image.file.type || "application/octet-stream",
    width: image.width,
    height: image.height,
    rotation: image.rotation,
    filters: toJsonClone(image.filters),
    source,
  };
};

const toDownloadItemDocument = async (
  collector: WorkspaceAssetCollector,
  item: DownloadItem,
): Promise<WorkspaceDownloadItemDocument> => {
  const blob = await (async () => {
    try {
      return await collector.addBlob("downloads", item.name, item.blob);
    } catch {
      return collector.add("downloads", {
        fileName: item.name,
        mimeType: item.blob?.type || "application/octet-stream",
        toBuffer: async () => fetchWorkspaceBinaryFromUrl(item.previewUrl, item.name),
      });
    }
  })();
  return {
    name: item.name,
    scope: item.scope,
    sourceImageId: item.sourceImageId,
    blob,
  };
};

const toAioDownloadDocument = async (
  collector: WorkspaceAssetCollector,
  item: AioDownloadEntry,
  fallbackPreviewUrl?: string | null,
): Promise<WorkspaceAioDownloadEntryDocument> => {
  const blob = await (async () => {
    try {
      return await collector.addBlob("aio-downloads", item.fileName, item.blob);
    } catch {
      if (!fallbackPreviewUrl) {
        throw new Error(
          `The workspace contains an invalid binary that cannot be saved locally (aio-downloads/${item.fileName}).`,
        );
      }
      return collector.add("aio-downloads", {
        fileName: item.fileName,
        mimeType: item.blob?.type || "application/octet-stream",
        toBuffer: async () =>
          fetchWorkspaceBinaryFromUrl(fallbackPreviewUrl, item.fileName),
      });
    }
  })();
  return {
    fileName: item.fileName,
    sourceImageId: item.sourceImageId,
    blob,
  };
};

const toManualImageEditDocument = async (
  collector: WorkspaceAssetCollector,
  imageId: string,
  state: AioManualImageEditState,
): Promise<WorkspaceManualImageEditDocument> => ({
  paintLayer: await collector.addDataUrl("manual-edits", `${imageId}-paint.png`, state.paintLayerDataUrl),
  baseImage: await collector.addDataUrl("manual-edits", `${imageId}-base.png`, state.baseImageDataUrl),
  wandMask: await collector.addDataUrl("manual-edits", `${imageId}-wand.png`, state.wandMaskDataUrl),
});

const toAioPipelineSnapshotDocument = async (
  collector: WorkspaceAssetCollector,
  snapshot: AioPipelineSnapshot,
  aioDownloadPreviewUrlByKey: Map<string, string>,
): Promise<WorkspaceAioPipelineSnapshotDocument> => ({
  key: snapshot.key,
  label: snapshot.label,
  detectionsByImage: toJsonClone(snapshot.detectionsByImage),
  selectedRegionByImage: toJsonClone(snapshot.selectedRegionByImage),
  aioDownloads: await Promise.all(
    snapshot.aioDownloads.map((item) =>
      toAioDownloadDocument(
        collector,
        item,
        aioDownloadPreviewUrlByKey.get(
          buildWorkspaceDownloadLookupKey(item.sourceImageId, item.fileName),
        ) ?? null,
      ),
    ),
  ),
});

const toProcessedBaseAssetMap = async (
  collector: WorkspaceAssetCollector,
  stateByImage: Record<string, string>,
): Promise<Record<string, { assetId: string }>> => {
  const entries = await Promise.all(
    Object.entries(stateByImage).map(async ([imageId, dataUrl]) => {
      const asset = await collector.addDataUrl("cleaner-base", `${imageId}-clean.png`, dataUrl);
      return asset ? [imageId, asset] as const : null;
    }),
  );
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, { assetId: string }] => Boolean(entry)));
};

const toManualImageEditsMap = async (
  collector: WorkspaceAssetCollector,
  value: Record<string, AioManualImageEditState>,
): Promise<Record<string, WorkspaceManualImageEditDocument>> => {
  const entries = await Promise.all(
    Object.entries(value).map(async ([imageId, state]) => [imageId, await toManualImageEditDocument(collector, imageId, state)] as const),
  );
  return Object.fromEntries(entries);
};

const toWatermarkResultDocument = async (
  collector: WorkspaceAssetCollector,
  item: WatermarkWorkspaceRuntimeState["results"][number],
): Promise<WorkspaceWatermarkResultDocument> => {
  const blob = await collector.addBlob("watermark-results", item.name, item.blob);
  return {
    sourceImageId: item.sourceImageId,
    name: item.name,
    resolvedAnchor: item.resolvedAnchor,
    blob,
  };
};

const toOptimizerResultDocument = async (
  collector: WorkspaceAssetCollector,
  item: OptimizationResult,
): Promise<WorkspaceOptimizerResultDocument> => {
  const blob = await collector.addBlob("optimizer-results", item.fileName, item.blob);
  return {
    sourceImageId: item.sourceImageId,
    fileName: item.fileName,
    originalBytes: item.originalBytes,
    optimizedBytes: item.optimizedBytes,
    width: item.width,
    height: item.height,
    blob,
  };
};

export const buildWorkspaceExportDefaultFileName = (
  mode: string,
  activeImage: LoadedImage | null,
): string => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const baseName = activeImage?.file.name
    ? activeImage.file.name.replace(/\.[^.]+$/u, "").replace(/[^\w.-]+/g, "-")
    : mode || "workspace";
  return `${baseName}-${stamp}.${WORKSPACE_FILE_EXTENSION}`;
};

export const captureWorkspaceDocument = async (
  state: DashboardWorkspaceCaptureState,
): Promise<WorkspacePackagePayload> => {
  const collector = new WorkspaceAssetCollector();
  const aioDownloadPreviewUrlByKey = new Map<string, string>();
  for (const item of state.downloadItems) {
    if (item.scope === "aio") {
      aioDownloadPreviewUrlByKey.set(buildWorkspaceDownloadLookupKey(item.sourceImageId, item.name), item.previewUrl);
    }
  }
  const images = await Promise.all(state.images.map((image) => toLoadedImageDocument(collector, image)));
  const downloadItems = await Promise.all(state.downloadItems.map((item) => toDownloadItemDocument(collector, item)));
  const aioPipelineSnapshots = await Promise.all(
    state.aio.pipelineSnapshots.map((snapshot) =>
      toAioPipelineSnapshotDocument(
        collector,
        snapshot as unknown as AioPipelineSnapshot,
        aioDownloadPreviewUrlByKey,
      ),
    ),
  );
  const aioManualImageEditsByImage = await toManualImageEditsMap(collector, state.aio.manualImageEditsByImage as unknown as Record<string, AioManualImageEditState>);
  const cleanerManualImageEditsByImage = await toManualImageEditsMap(collector, state.cleaner.manualImageEditsByImage);
  const cleanerProcessedBaseAssetByImage = await toProcessedBaseAssetMap(collector, state.cleaner.processedBaseByImage);
  const translatorProcessedBaseAssetByImage = await toProcessedBaseAssetMap(collector, state.translator.translatorProcessedBaseByImage);
  const watermarkImage = state.utility.watermark.watermarkImageFile
    ? await collector.addFile("watermark-source", state.utility.watermark.watermarkImageFile)
    : null;
  const watermarkResults = await Promise.all(state.utility.watermark.results.map((item) => toWatermarkResultDocument(collector, item)));
  const optimizerResults = await Promise.all(state.utility.optimizer.results.map((item) => toOptimizerResultDocument(collector, item)));

  const document: WorkspaceDocumentV1 = {
    version: WORKSPACE_DOCUMENT_VERSION,
    savedAt: new Date().toISOString(),
    autosaveScope: state.autosaveScope,
    autosaveUserId: state.autosaveUserId,
    view: {
      mode: state.mode,
      subMode: state.subMode,
      activeImageId: state.activeImageId,
      viewMode: state.viewMode,
      translatorWorkspaceMode: state.translatorWorkspaceMode,
      translatorVisualProcessingMode: state.translatorVisualProcessingMode,
    },
    footer: {
      lastActionScope: state.lastActionScope,
      statusMessage: state.statusMessage,
    },
    images,
    downloadItems,
    batchThreadsEnabled: state.batchThreadsEnabled,
    batchThreads: state.batchThreads,
    aio: {
      ...toJsonClone(state.aio),
      pipelineSnapshots: aioPipelineSnapshots,
      manualImageEditsByImage: aioManualImageEditsByImage,
    },
    cleaner: {
      detectionsByImage: toJsonClone(state.cleaner.detectionsByImage),
      selectedRegionByImage: toJsonClone(state.cleaner.selectedRegionByImage),
      processedBaseAssetByImage: cleanerProcessedBaseAssetByImage,
      runMetaByImage: toJsonClone(state.cleaner.runMetaByImage),
      manualImageEditsByImage: cleanerManualImageEditsByImage,
    },
    translator: {
      ...toJsonClone(state.translator),
      translatorProcessedBaseAssetByImage: translatorProcessedBaseAssetByImage,
    },
    typesetter: {
      selectionTool: state.typesetter.selectionTool,
      queueSelectedId: state.typesetter.queueSelectedId,
      snapshotName: state.typesetter.snapshotName,
      selectedSnapshotId: state.typesetter.selectedSnapshotId,
      sessionsByImage: toJsonClone(state.typesetter.sessionsByImage),
    },
    enhance: toJsonClone(state.enhance),
    utility: {
      stitch: toJsonClone(state.utility.stitch),
      splitter: {
        recipe: toJsonClone(state.utility.splitter.recipe),
        imageStates: toJsonClone(state.utility.splitter.imageStates),
        activeImageId: state.utility.splitter.activeImageId,
      },
      watermark: {
        draft: toJsonClone(state.utility.watermark.draft),
        activeImageId: state.utility.watermark.activeImageId,
        compareMode: state.utility.watermark.compareMode,
        compareValue: state.utility.watermark.compareValue,
        selectedPresetId: state.utility.watermark.selectedPresetId,
        autoSuggestion: state.utility.watermark.autoSuggestion,
        userPresets: toJsonClone(state.utility.watermark.userPresets),
        watermarkImage,
        results: watermarkResults,
        textZoneCache: toJsonClone(state.utility.watermark.textZoneCache ?? {}),
      },
      optimizer: {
        recipe: toJsonClone(state.utility.optimizer.recipe),
        selectedPreset: state.utility.optimizer.selectedPreset,
        activeImageId: state.utility.optimizer.activeImageId,
        results: optimizerResults,
      },
    },
    llm: toJsonClone(state.llm),
  };

  const manifest: WorkspacePackageManifestV1 = {
    packageVersion: 1,
    exportedAt: document.savedAt,
    app: "koma-studio",
    documentVersion: WORKSPACE_DOCUMENT_VERSION,
    document,
    assets: collector.getAssets().map((asset) => ({
      id: asset.id,
      path: asset.path,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      byteLength: asset.buffer.byteLength,
    })),
  };

  return {
    manifest,
    assets: collector.getAssets(),
  };
};

const buildAssetMap = (payload: WorkspacePackagePayload): Map<string, WorkspaceBinaryAssetPayload> =>
  new Map(payload.assets.map((asset) => [asset.id, asset] as const));

const requireAsset = (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  assetId: string,
): WorkspaceBinaryAssetPayload => {
  const asset = assetMap.get(assetId) ?? null;
  if (!asset) {
    throw new Error(`Asset de workspace ausente: ${assetId}`);
  }
  return asset;
};

const toFileFromAsset = (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  assetId: string,
): File => {
  const asset = requireAsset(assetMap, assetId);
  return new File([asset.buffer.slice(0)], asset.fileName, {
    type: asset.mimeType,
    lastModified: Date.now(),
  });
};

const toBlobFromAsset = (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  assetId: string,
): Blob => {
  const asset = requireAsset(assetMap, assetId);
  return new Blob([asset.buffer.slice(0)], { type: asset.mimeType });
};

const toDataUrlFromAsset = async (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  assetId: string,
): Promise<string> => blobToDataUrl(toBlobFromAsset(assetMap, assetId));

const restoreLoadedImage = (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  item: WorkspaceLoadedImageDocument,
): LoadedImage => {
  const file = toFileFromAsset(assetMap, item.source.assetId);
  // Owned by the restored image collection; revoked on image removal
  // (revokeLoadedImageUrls).
  const url = URL.createObjectURL(file);
  const image = {
    id: item.id,
    file,
    url,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    filters: item.filters as ImageFilters,
  };
  return image;
};

const restoreDownloadItem = (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  item: WorkspaceDownloadItemDocument,
): DownloadItem => {
  const blob = toBlobFromAsset(assetMap, item.blob.assetId);
  // Owned by the restored download registry; revoked when the entry is
  // replaced or removed (registerDownloads / removeImage).
  const previewUrl = URL.createObjectURL(blob);
  const downloadItem = {
    name: item.name,
    blob,
    scope: item.scope as DownloadItem["scope"],
    sourceImageId: item.sourceImageId,
    previewUrl,
  };
  return downloadItem;
};

const restoreAioDownloadItem = (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  item: WorkspaceAioDownloadEntryDocument,
): AioPipelineSnapshot["aioDownloads"][number] => ({
  fileName: item.fileName,
  sourceImageId: item.sourceImageId,
  blob: toBlobFromAsset(assetMap, item.blob.assetId),
});

const restoreManualImageEdit = async (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  item: WorkspaceManualImageEditDocument | null | undefined,
): Promise<AioManualImageEditState> => ({
  paintLayerDataUrl: item?.paintLayer ? await toDataUrlFromAsset(assetMap, item.paintLayer.assetId) : null,
  baseImageDataUrl: item?.baseImage ? await toDataUrlFromAsset(assetMap, item.baseImage.assetId) : null,
  wandMaskDataUrl: item?.wandMask ? await toDataUrlFromAsset(assetMap, item.wandMask.assetId) : null,
} as AioManualImageEditState);

const restoreManualImageEditMap = async (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  items: Record<string, WorkspaceManualImageEditDocument>,
): Promise<Record<string, AioManualImageEditState>> => {
  const entries = await Promise.all(
    Object.entries(items).map(async ([imageId, value]) => [imageId, await restoreManualImageEdit(assetMap, value)] as const),
  );
  return Object.fromEntries(entries);
};

const restoreProcessedBaseMap = async (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  items: Record<string, { assetId: string }>,
): Promise<Record<string, string>> => {
  const entries = await Promise.all(
    Object.entries(items).map(async ([imageId, ref]) => [imageId, await toDataUrlFromAsset(assetMap, ref.assetId)] as const),
  );
  return Object.fromEntries(entries);
};

const restoreWatermarkState = async (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  utility: WorkspaceUtilityStateDocument["watermark"],
): Promise<WatermarkWorkspaceRuntimeState> => {
  const results: WatermarkWorkspaceRuntimeState["results"] = [];
  for (const item of utility.results) {
    const blob = toBlobFromAsset(assetMap, item.blob.assetId);
    const previewUrl = URL.createObjectURL(blob);
    results.push({
      sourceImageId: item.sourceImageId,
      name: item.name,
      blob,
      previewUrl,
      resolvedAnchor: item.resolvedAnchor,
    });
  }
  return {
  draft: toJsonClone(utility.draft),
  activeImageId: utility.activeImageId,
  compareMode: utility.compareMode,
  compareValue: utility.compareValue,
  selectedPresetId: utility.selectedPresetId,
  autoSuggestion: utility.autoSuggestion,
  userPresets: toJsonClone(utility.userPresets),
  watermarkImageFile: utility.watermarkImage
    ? toFileFromAsset(assetMap, utility.watermarkImage.assetId)
    : null,
  results,
  textZoneCache: (utility as WorkspaceWatermarkDocumentWithTextZoneCache).textZoneCache ?? {},
  };
};

const restoreOptimizerState = (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  utility: WorkspaceUtilityStateDocument["optimizer"],
): OptimizerWorkspaceRuntimeState => ({
  recipe: toJsonClone(utility.recipe),
  selectedPreset: utility.selectedPreset,
  activeImageId: utility.activeImageId,
  results: utility.results.map((item) => ({
    sourceImageId: item.sourceImageId,
    fileName: item.fileName,
    blob: toBlobFromAsset(assetMap, item.blob.assetId),
    originalBytes: item.originalBytes,
    optimizedBytes: item.optimizedBytes,
    width: item.width,
    height: item.height,
  })) as OptimizerWorkspaceRuntimeState["results"],
});

export const restoreWorkspaceDocument = async (
  payload: WorkspacePackagePayload,
): Promise<DashboardWorkspaceRestoreState> => {
  const assetMap = buildAssetMap(payload);
  const document = payload.manifest.document;

  const images = document.images.map((item) => restoreLoadedImage(assetMap, item));
  const downloadItems = document.downloadItems.map((item) => restoreDownloadItem(assetMap, item));
  const aioManualImageEditsByImage = await restoreManualImageEditMap(assetMap, document.aio.manualImageEditsByImage);
  const cleanerManualImageEditsByImage = await restoreManualImageEditMap(assetMap, document.cleaner.manualImageEditsByImage);
  const cleanerProcessedBaseByImage = await restoreProcessedBaseMap(assetMap, document.cleaner.processedBaseAssetByImage);
  const translatorProcessedBaseByImage = await restoreProcessedBaseMap(assetMap, document.translator.translatorProcessedBaseAssetByImage ?? {});

  return {
    document: toJsonClone(document),
    images,
    downloadItems,
    aio: {
      ...toJsonClone(document.aio),
      pipelineSnapshots: document.aio.pipelineSnapshots.map((snapshot) => ({
        key: snapshot.key,
        label: snapshot.label,
        detectionsByImage: toJsonClone(snapshot.detectionsByImage),
        selectedRegionByImage: toJsonClone(snapshot.selectedRegionByImage),
        aioDownloads: snapshot.aioDownloads.map((item) => restoreAioDownloadItem(assetMap, item)),
      })) as unknown as WorkspaceDocumentV1["aio"]["pipelineSnapshots"],
      manualImageEditsByImage: aioManualImageEditsByImage as unknown as WorkspaceDocumentV1["aio"]["manualImageEditsByImage"],
    },
    cleaner: {
      ...toJsonClone(document.cleaner),
      processedBaseByImage: cleanerProcessedBaseByImage,
      manualImageEditsByImage: cleanerManualImageEditsByImage,
    },
    translator: {
      ...toJsonClone(document.translator),
      translatorProcessedBaseByImage,
    },
    typesetter: {
      selectionTool: document.typesetter.selectionTool,
      queueSelectedId: document.typesetter.queueSelectedId,
      snapshotName: document.typesetter.snapshotName,
      selectedSnapshotId: document.typesetter.selectedSnapshotId,
      sessionsByImage: toJsonClone(document.typesetter.sessionsByImage) as Record<string, TypographySession>,
    },
    utility: {
      splitter: {
        recipe: toJsonClone(document.utility.splitter.recipe),
        imageStates: toJsonClone(document.utility.splitter.imageStates),
        activeImageId: document.utility.splitter.activeImageId,
      },
      watermark: await restoreWatermarkState(assetMap, document.utility.watermark),
      optimizer: restoreOptimizerState(assetMap, document.utility.optimizer),
    },
  };
};

export const buildWorkspaceExportPayload = async (
  state: DashboardWorkspaceCaptureState,
): Promise<WorkspaceExportPayload> => ({
  defaultFileName: buildWorkspaceExportDefaultFileName(
    state.mode,
    state.images.find((item) => item.id === state.activeImageId) ?? null,
  ),
  payload: await captureWorkspaceDocument(state),
});
