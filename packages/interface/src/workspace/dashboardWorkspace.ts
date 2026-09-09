import type {
  WorkspaceAutosaveScope,
  WorkspaceCleanerStateDocument,
  WorkspaceDocumentV1,
} from "../../../../packages/types/src/workspace";
import type {
  AioManualImageEditState,
  AioPipelineSnapshot,
  DownloadItem,
  ImageFilters,
  LoadedImage,
  TranslatorVisualProcessingMode,
} from "../types/dashboard.types";
import type { OptimizationResult } from "../types";
import type { TypographySession } from "../typography/types";

export interface WatermarkWorkspaceRuntimeState {
  draft: unknown;
  activeImageId: string | null;
  compareMode: "split" | "preview";
  compareValue: number;
  selectedPresetId: string;
  autoSuggestion: string;
  userPresets: unknown[];
  watermarkImageFile: File | null;
  results: Array<{
    sourceImageId: string;
    name: string;
    blob: Blob;
    previewUrl: string;
    resolvedAnchor: string;
  }>;
  textZoneCache?: Record<string, Array<{ id: string; bbox: [number, number, number, number]; score: number; label: string }>>;
}

export interface OptimizerWorkspaceRuntimeState {
  recipe: unknown;
  selectedPreset: string;
  activeImageId: string | null;
  results: OptimizationResult[];
}

export interface SplitterWorkspaceRuntimeState {
  recipe: unknown;
  imageStates: Record<string, unknown>;
  activeImageId: string | null;
}

export interface DashboardWorkspaceCaptureState {
  autosaveScope: WorkspaceAutosaveScope;
  autosaveUserId: string | null;
  mode: string;
  subMode: string;
  activeImageId: string | null;
  viewMode: string;
  translatorWorkspaceMode: string;
  translatorVisualProcessingMode: TranslatorVisualProcessingMode;
  statusMessage: string;
  lastActionScope: string | null;
  images: LoadedImage[];
  downloadItems: DownloadItem[];
  batchThreadsEnabled: boolean;
  batchThreads: number;
  aio: WorkspaceDocumentV1["aio"];
  cleaner: Omit<WorkspaceCleanerStateDocument, "processedBaseAssetByImage" | "manualImageEditsByImage"> & {
    processedBaseByImage: Record<string, string>;
    manualImageEditsByImage: Record<string, AioManualImageEditState>;
  };
  translator: Omit<WorkspaceDocumentV1["translator"], "translatorProcessedBaseAssetByImage"> & {
    translatorProcessedBaseByImage: Record<string, string>;
  };
  typesetter: {
    selectionTool: string;
    queueSelectedId: string | null;
    snapshotName: string;
    selectedSnapshotId: string | null;
    sessionsByImage: Record<string, TypographySession>;
  };
  enhance: WorkspaceDocumentV1["enhance"];
  utility: {
    stitch: WorkspaceDocumentV1["utility"]["stitch"];
    splitter: SplitterWorkspaceRuntimeState;
    watermark: WatermarkWorkspaceRuntimeState;
    optimizer: OptimizerWorkspaceRuntimeState;
  };
  llm: WorkspaceDocumentV1["llm"];
}

export interface DashboardWorkspaceRestoreState {
  document: WorkspaceDocumentV1;
  images: LoadedImage[];
  downloadItems: DownloadItem[];
  aio: WorkspaceDocumentV1["aio"];
  cleaner: WorkspaceCleanerStateDocument & {
    processedBaseByImage: Record<string, string>;
    manualImageEditsByImage: Record<string, AioManualImageEditState>;
  };
  translator: Omit<WorkspaceDocumentV1["translator"], "translatorProcessedBaseAssetByImage"> & {
    translatorProcessedBaseByImage: Record<string, string>;
  };
  typesetter: {
    selectionTool: string;
    queueSelectedId: string | null;
    snapshotName: string;
    selectedSnapshotId: string | null;
    sessionsByImage: Record<string, TypographySession>;
  };
  utility: {
    splitter: SplitterWorkspaceRuntimeState;
    watermark: WatermarkWorkspaceRuntimeState;
    optimizer: OptimizerWorkspaceRuntimeState;
  };
}

export interface HistoryBlobHandle {
  __historyKind: "blob";
  assetId: string;
  type: string;
  size: number;
}

export interface HistoryDataUrlHandle {
  __historyKind: "data-url";
  assetId: string;
  length: number;
}

export interface HistoryAioDownloadEntry {
  fileName: string;
  blob: HistoryBlobHandle;
  sourceImageId: string;
}

export interface HistoryManualImageEditState {
  paintLayerDataUrl: HistoryDataUrlHandle | null;
  baseImageDataUrl: HistoryDataUrlHandle | null;
  wandMaskDataUrl: HistoryDataUrlHandle | null;
}

export interface HistoryWatermarkResultEntry {
  sourceImageId: string;
  name: string;
  blob: HistoryBlobHandle;
  previewUrl: string;
  resolvedAnchor: string;
}

export interface HistoryOptimizerResultEntry {
  sourceImageId: string;
  fileName: string;
  blob: HistoryBlobHandle;
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
}

export interface DashboardWorkspaceHistorySnapshot {
  mode: string;
  subMode: string;
  activeImageId: string | null;
  viewMode: string;
  translatorWorkspaceMode: string;
  translatorVisualProcessingMode: TranslatorVisualProcessingMode;
  statusMessage: string;
  lastActionScope: string | null;
  images: Array<{
    id: string;
    file: File;
    width: number;
    height: number;
    rotation: number;
    filters: ImageFilters;
  }>;
  downloadItems: Array<{
    name: string;
    blob: HistoryBlobHandle;
    scope: string;
    sourceImageId: string;
  }>;
  batchThreadsEnabled: boolean;
  batchThreads: number;
  aio: Omit<
    DashboardWorkspaceCaptureState["aio"],
    "pipelineSnapshots" | "manualImageEditsByImage"
  > & {
    pipelineSnapshots: Array<
      Omit<AioPipelineSnapshot, "aioDownloads"> & {
        aioDownloads: HistoryAioDownloadEntry[];
      }
    >;
    manualImageEditsByImage: Record<string, HistoryManualImageEditState>;
  };
  cleaner: Omit<
    DashboardWorkspaceCaptureState["cleaner"],
    "processedBaseByImage" | "manualImageEditsByImage"
  > & {
    processedBaseByImage: Record<string, HistoryDataUrlHandle>;
    manualImageEditsByImage: Record<string, HistoryManualImageEditState>;
  };
  translator: DashboardWorkspaceCaptureState["translator"];
  typesetter: DashboardWorkspaceCaptureState["typesetter"];
  enhance: DashboardWorkspaceCaptureState["enhance"];
  utility: Omit<
    DashboardWorkspaceCaptureState["utility"],
    "watermark" | "optimizer"
  > & {
    watermark: Omit<WatermarkWorkspaceRuntimeState, "results"> & {
      results: HistoryWatermarkResultEntry[];
    };
    optimizer: Omit<OptimizerWorkspaceRuntimeState, "results"> & {
      results: HistoryOptimizerResultEntry[];
    };
  };
  llm: DashboardWorkspaceCaptureState["llm"];
}

export {
  buildWorkspaceExportDefaultFileName,
  captureWorkspaceDocument,
  restoreWorkspaceDocument,
  buildWorkspaceExportPayload,
} from "./dashboardWorkspace.serialization";

export {
  captureWorkspaceHistorySnapshot,
  restoreWorkspaceHistorySnapshot,
  releaseWorkspaceHistorySnapshot,
} from "./dashboardWorkspace.history";

export {
  buildWorkspaceHistorySignature,
  buildWorkspaceAutosaveSignature,
} from "./dashboardWorkspace.signature";
