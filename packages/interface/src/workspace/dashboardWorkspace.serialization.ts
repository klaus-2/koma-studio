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
import type { TypographySession } from "../typography/types";
import type {
  DashboardWorkspaceCaptureState,
  DashboardWorkspaceRestoreState,
} from "./dashboardWorkspace";
import { jsonSafeClone as toJsonClone } from "./jsonSafeClone";
import {
  forceRenderSizesInPlace,
  shouldMigrateWorkspaceRenderSizes,
} from "../utils/renderSizeDefaults";
import { blobToDataUrl, dataUrlToBlob } from "../utils/dashboard.utils";
import { createThumbnailFromUrl } from "../utils/imagePerformance";
import { stitchWorkspaceCodec } from "../components/dashboard/stitch/workspaceCodec";
import { splitterWorkspaceCodec } from "../components/dashboard/splitter/workspaceCodec";
import { watermarkWorkspaceCodec, type WorkspaceCodecAssetSource } from "../components/dashboard/watermark/workspaceCodec";
import { optimizerWorkspaceCodec } from "../components/dashboard/optimizer/workspaceCodec";

interface WorkspaceAssetSourceLike {
  fileName: string;
  mimeType: string;
  toBuffer: () => Promise<ArrayBuffer>;
}

const buildWorkspaceDownloadLookupKey = (
  sourceImageId: string,
  fileName: string,
): string => `${sourceImageId}::${fileName}`;

export const cloneArrayBufferLike = (value: unknown): ArrayBuffer | null => {
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
    ...(image.chapterId ? { chapterId: image.chapterId } : {}),
    ...(image.chapterLabel ? { chapterLabel: image.chapterLabel } : {}),
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
): Promise<WorkspaceManualImageEditDocument> => {
  const [paintLayer, baseImage, wandMask] = await Promise.all([
    collector.addDataUrl("manual-edits", `${imageId}-paint.png`, state.paintLayerDataUrl),
    collector.addDataUrl("manual-edits", `${imageId}-base.png`, state.baseImageDataUrl),
    collector.addDataUrl("manual-edits", `${imageId}-wand.png`, state.wandMaskDataUrl),
  ]);
  return { paintLayer, baseImage, wandMask };
};

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
  const [
    aioManualImageEditsByImage,
    cleanerManualImageEditsByImage,
    cleanerProcessedBaseAssetByImage,
    translatorProcessedBaseAssetByImage,
  ] = await Promise.all([
    toManualImageEditsMap(collector, state.aio.manualImageEditsByImage as unknown as Record<string, AioManualImageEditState>),
    toManualImageEditsMap(collector, state.cleaner.manualImageEditsByImage),
    toProcessedBaseAssetMap(collector, state.cleaner.processedBaseByImage),
    toProcessedBaseAssetMap(collector, state.translator.translatorProcessedBaseByImage),
  ]);
  // Special-tool document groups are built by their colocated codecs (same
  // collector call order as the pre-codec implementation).
  const stitchDocument = stitchWorkspaceCodec.toDocument(state.utility.stitch);
  const splitterDocument = splitterWorkspaceCodec.toDocument(state.utility.splitter);
  const watermarkDocument = await watermarkWorkspaceCodec.toDocument(state.utility.watermark, collector);
  const optimizerDocument = await optimizerWorkspaceCodec.toDocument(state.utility.optimizer, collector);

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
      stitch: stitchDocument,
      splitter: splitterDocument,
      watermark: watermarkDocument,
      optimizer: optimizerDocument,
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
  // `asset.buffer` may arrive as an ArrayBuffer (in-memory / browser zip), an
  // ArrayBufferView, or a plain number[] (Tauri serializes Vec<u8> as a JSON
  // number array over IPC). `new File([numberArray])` stringifies the array
  // instead of treating it as bytes, yielding a corrupt (broken) image on
  // restore — so normalize to a real binary buffer first.
  const buffer = cloneArrayBufferLike(asset.buffer);
  if (!buffer) {
    throw new Error(`Buffer binário inválido no asset de workspace: ${assetId}`);
  }
  return new File([buffer], asset.fileName, {
    type: asset.mimeType,
    lastModified: Date.now(),
  });
};

const toBlobFromAsset = (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  assetId: string,
): Blob => {
  const asset = requireAsset(assetMap, assetId);
  const buffer = cloneArrayBufferLike(asset.buffer);
  if (!buffer) {
    throw new Error(`Buffer binário inválido no asset de workspace: ${assetId}`);
  }
  return new Blob([buffer], { type: asset.mimeType });
};

const toDataUrlFromAsset = async (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  assetId: string,
): Promise<string> => blobToDataUrl(toBlobFromAsset(assetMap, assetId));

const restoreLoadedImage = async (
  assetMap: Map<string, WorkspaceBinaryAssetPayload>,
  item: WorkspaceLoadedImageDocument,
): Promise<LoadedImage> => {
  const file = toFileFromAsset(assetMap, item.source.assetId);
  // Owned by the restored image collection; revoked on image removal
  // (revokeLoadedImageUrls).
  const url = URL.createObjectURL(file);
  // Regenerate thumbnail so the sidebar does not decode full-res images.
  const thumbnailUrl = await createThumbnailFromUrl(url, 400, 600, 0.7).catch(
    () => url,
  );
  const image: LoadedImage = {
    id: item.id,
    file,
    url,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    filters: item.filters as ImageFilters,
  };
  if (item.chapterId) image.chapterId = item.chapterId;
  if (item.chapterLabel) image.chapterLabel = item.chapterLabel;
  if (thumbnailUrl !== url) {
    image.thumbnailUrl = thumbnailUrl;
  }
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
): Promise<AioManualImageEditState> => {
  const [paintLayerDataUrl, baseImageDataUrl, wandMaskDataUrl] = await Promise.all([
    item?.paintLayer ? toDataUrlFromAsset(assetMap, item.paintLayer.assetId) : Promise.resolve(null),
    item?.baseImage ? toDataUrlFromAsset(assetMap, item.baseImage.assetId) : Promise.resolve(null),
    item?.wandMask ? toDataUrlFromAsset(assetMap, item.wandMask.assetId) : Promise.resolve(null),
  ]);
  return {
    paintLayerDataUrl,
    baseImageDataUrl,
    wandMaskDataUrl,
    // Workspace v1 does not serialize segmentBrush; restore preserves the rest.
    segmentBrushDataUrl: null,
  };
};

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

// Documents written before the asset-map split can carry the processed-base
// dataUrls inline; the frozen document type only declares the asset field.
type LegacyTranslatorProcessedBaseDocument = {
  translatorProcessedBaseByImage?: Record<string, string>;
};

const legacyTranslatorProcessedBaseByImage = (
  document: WorkspaceDocumentV1,
): Record<string, string> => {
  const translator =
    document.translator as WorkspaceDocumentV1["translator"] &
      LegacyTranslatorProcessedBaseDocument;
  return translator.translatorProcessedBaseByImage ?? {};
};

export const restoreWorkspaceDocument = async (
  payload: WorkspacePackagePayload,
): Promise<DashboardWorkspaceRestoreState> => {
  const assetMap = buildAssetMap(payload);
  const document = payload.manifest.document;

  const images = await Promise.all(
    document.images.map((item) => restoreLoadedImage(assetMap, item)),
  );
  const downloadItems = document.downloadItems.map((item) => restoreDownloadItem(assetMap, item));
  const codecAssetSource: WorkspaceCodecAssetSource = {
    resolveFile: (assetId) => toFileFromAsset(assetMap, assetId),
    resolveBlob: (assetId) => toBlobFromAsset(assetMap, assetId),
  };
  const translatorProcessedBaseAssetByImage =
    document.translator.translatorProcessedBaseAssetByImage;
  const [
    aioManualImageEditsByImage,
    cleanerManualImageEditsByImage,
    cleanerProcessedBaseByImage,
    translatorProcessedBaseByImage,
    watermark,
  ] = await Promise.all([
    restoreManualImageEditMap(assetMap, document.aio.manualImageEditsByImage),
    restoreManualImageEditMap(assetMap, document.cleaner.manualImageEditsByImage),
    restoreProcessedBaseMap(assetMap, document.cleaner.processedBaseAssetByImage),
    translatorProcessedBaseAssetByImage
      ? restoreProcessedBaseMap(assetMap, translatorProcessedBaseAssetByImage)
      : Promise.resolve(legacyTranslatorProcessedBaseByImage(document)),
    watermarkWorkspaceCodec.toRuntime(document.utility.watermark, codecAssetSource),
  ]);

  const restored: DashboardWorkspaceRestoreState = {
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
      splitter: splitterWorkspaceCodec.toRuntime(document.utility.splitter),
      watermark,
      optimizer: optimizerWorkspaceCodec.toRuntime(document.utility.optimizer, codecAssetSource),
    },
  };

  // Forced on every restore until the caller persists the migrated document
  // (then markWorkspaceRenderSizesMigrated stops it).
  if (shouldMigrateWorkspaceRenderSizes()) {
    forceRenderSizesInPlace(restored);
  }

  return restored;
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
