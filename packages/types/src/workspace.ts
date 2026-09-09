export const WORKSPACE_DOCUMENT_VERSION = 1;
export const WORKSPACE_FILE_EXTENSION = "koma";
export const WORKSPACE_AUTOSAVE_FILE_BASENAME = "autosave";

export type WorkspaceAutosaveScope = "guest" | "user";

export interface WorkspaceBinaryAssetPayload {
  id: string;
  path: string;
  fileName: string;
  mimeType: string;
  buffer: ArrayBuffer;
}

export interface WorkspaceAssetManifestEntry {
  id: string;
  path: string;
  fileName: string;
  mimeType: string;
  byteLength: number;
}

export interface WorkspaceAssetRef {
  assetId: string;
}

export interface WorkspaceImageFiltersDocument {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpen: number;
  levels: { black: number; white: number; gamma: number };
  grayscale: boolean;
  inverted: boolean;
}

export interface WorkspaceLoadedImageDocument {
  id: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  rotation: number;
  filters: WorkspaceImageFiltersDocument;
  source: WorkspaceAssetRef;
}

export interface WorkspaceDownloadItemDocument {
  name: string;
  scope: string;
  sourceImageId: string;
  blob: WorkspaceAssetRef;
}

export interface WorkspaceAioDownloadEntryDocument {
  fileName: string;
  sourceImageId: string;
  blob: WorkspaceAssetRef;
}

export interface WorkspaceManualImageEditDocument {
  paintLayer?: WorkspaceAssetRef | null;
  baseImage?: WorkspaceAssetRef | null;
  wandMask?: WorkspaceAssetRef | null;
}

export interface WorkspaceStitchStateDocument {
  stitchLayoutMode: string;
  stitchBatchStrategy: string;
  stitchBatchSize: number;
  stitchTargetPrimaryAxis: number;
  stitchGap: number;
  stitchAlignMode: string;
  stitchBackground: string;
  stitchSingleExportFormat: string;
  stitchFileBaseName: string;
  stitchSelectedBatchIndex: number;
  stitchBatchIndexes: number[][];
}

export interface WorkspaceSplitterStateDocument {
  recipe: unknown;
  imageStates: Record<string, unknown>;
  activeImageId: string | null;
}

export interface WorkspaceWatermarkResultDocument {
  sourceImageId: string;
  name: string;
  resolvedAnchor: string;
  blob: WorkspaceAssetRef;
}

export interface WorkspaceWatermarkStateDocument {
  draft: unknown;
  activeImageId: string | null;
  compareMode: "split" | "preview";
  compareValue: number;
  selectedPresetId: string;
  autoSuggestion: string;
  userPresets: unknown[];
  watermarkImage?: WorkspaceAssetRef | null;
  results: WorkspaceWatermarkResultDocument[];
  textZoneCache?: Record<string, Array<{ id: string; bbox: [number, number, number, number]; score: number; label: string }>>;
}

export interface WorkspaceOptimizerResultDocument {
  sourceImageId: string;
  fileName: string;
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
  blob: WorkspaceAssetRef;
}

export interface WorkspaceOptimizerStateDocument {
  recipe: unknown;
  selectedPreset: string;
  activeImageId: string | null;
  results: WorkspaceOptimizerResultDocument[];
}

export interface WorkspaceFooterStateDocument {
  lastActionScope: string | null;
  statusMessage: string;
}

export interface WorkspaceUtilityStateDocument {
  stitch: WorkspaceStitchStateDocument;
  splitter: WorkspaceSplitterStateDocument;
  watermark: WorkspaceWatermarkStateDocument;
  optimizer: WorkspaceOptimizerStateDocument;
}

export interface WorkspaceViewStateDocument {
  mode: string;
  subMode: string;
  activeImageId: string | null;
  viewMode: string;
  translatorWorkspaceMode: string;
  translatorVisualProcessingMode?: string;
}

export interface WorkspaceEnhanceStateDocument {
  scale: number;
  profile: string;
  modelId: string;
  outputFormat: string;
}

export interface WorkspaceTranslatorStateDocument {
  srcLang: string;
  tgtLang: string;
  aioSrcLang: string;
  aioTgtLang: string;
  translatorDraftText: string;
  translatorTranslatedText: string;
  translatorLastTextModelUsed: string | null;
  translatorTextDirty: boolean;
  translatorDetectionsByImage: Record<string, unknown[]>;
  translatorSelectedRegionByImage: Record<string, string | null>;
  translatorRunMetaByImage: Record<string, unknown>;
  translatorProcessedBaseAssetByImage?: Record<string, WorkspaceAssetRef>;
}

export interface WorkspaceCleanerStateDocument {
  detectionsByImage: Record<string, unknown[]>;
  selectedRegionByImage: Record<string, string | null>;
  processedBaseAssetByImage: Record<string, WorkspaceAssetRef>;
  runMetaByImage: Record<string, unknown>;
  manualImageEditsByImage: Record<string, WorkspaceManualImageEditDocument>;
}

export interface WorkspaceAioPipelineSnapshotDocument {
  key: string;
  label: string;
  detectionsByImage: Record<string, unknown[]>;
  selectedRegionByImage: Record<string, string | null>;
  aioDownloads: WorkspaceAioDownloadEntryDocument[];
}

export interface WorkspaceAioStateDocument {
  steps: Record<string, boolean>;
  stageSelection: Record<string, string>;
  presetState: unknown;
  maskDilation: number;
  hdStrategy: string;
  hdResizeLimit: number;
  hdCropMargin: number;
  hdCropTriggerSize: number;
  detectionsByImage: Record<string, unknown[]>;
  selectedRegionByImage: Record<string, string | null>;
  pipelineSnapshots: WorkspaceAioPipelineSnapshotDocument[];
  pipelineSnapshotIndex: number;
  imageSnapshotIndexById: Record<string, number>;
  autoHistoryAvailable: boolean;
  autoProcessedImageById: Record<string, boolean>;
  // v1 union: v1 charges manual quota per image in the AIO pipeline (v2 does
  // not use it — required to keep the v1 contract; v2 builds with {} when the
  // typecheck asks for it).
  manualQuotaChargedByImage: Record<string, boolean>;
  manualProgressByImage: Record<string, unknown>;
  manualImageEditsByImage: Record<string, WorkspaceManualImageEditDocument>;
}

export interface WorkspaceTypesetterStateDocument {
  selectionTool: string;
  queueSelectedId: string | null;
  snapshotName: string;
  selectedSnapshotId: string | null;
  sessionsByImage: Record<string, unknown>;
}

export interface WorkspaceLlmStateDocument {
  llmSettings: unknown;
  customLlmProfiles: unknown[];
  customLlmProfilesMode: string;
  pendingCustomSelections: Record<string, string | null>;
  customLlmDrafts: Record<string, unknown>;
  freeProviderDrafts: Record<string, unknown>;
}

export interface WorkspaceDocumentV1 {
  version: 1;
  savedAt: string;
  autosaveScope: WorkspaceAutosaveScope;
  autosaveUserId: string | null;
  view: WorkspaceViewStateDocument;
  footer: WorkspaceFooterStateDocument;
  images: WorkspaceLoadedImageDocument[];
  downloadItems: WorkspaceDownloadItemDocument[];
  batchThreadsEnabled: boolean;
  batchThreads: number;
  aio: WorkspaceAioStateDocument;
  cleaner: WorkspaceCleanerStateDocument;
  translator: WorkspaceTranslatorStateDocument;
  typesetter: WorkspaceTypesetterStateDocument;
  enhance: WorkspaceEnhanceStateDocument;
  utility: WorkspaceUtilityStateDocument;
  llm: WorkspaceLlmStateDocument;
}

export interface WorkspacePackageManifestV1 {
  packageVersion: 1;
  exportedAt: string;
  app: "koma-studio";
  documentVersion: 1;
  document: WorkspaceDocumentV1;
  assets: WorkspaceAssetManifestEntry[];
}

export interface WorkspacePackagePayload {
  manifest: WorkspacePackageManifestV1;
  assets: WorkspaceBinaryAssetPayload[];
}

export interface WorkspaceAutosaveLoadResult {
  found: boolean;
  path?: string | null;
  payload?: WorkspacePackagePayload | null;
}

export interface WorkspaceAutosaveSavePayload {
  userId?: string | null;
  payload: WorkspacePackagePayload;
}

export interface WorkspaceAutosaveSaveResult {
  saved: boolean;
  path: string;
}

export interface WorkspaceAutosaveClearPayload {
  userId?: string | null;
}

export interface WorkspaceAutosaveClearResult {
  cleared: boolean;
}

export interface WorkspaceExportPayload {
  defaultFileName: string;
  payload: WorkspacePackagePayload;
}

export interface WorkspaceExportResult {
  cancelled: boolean;
  filePath?: string | null;
}

export interface WorkspaceImportResult {
  cancelled: boolean;
  filePath?: string | null;
  payload?: WorkspacePackagePayload | null;
}
