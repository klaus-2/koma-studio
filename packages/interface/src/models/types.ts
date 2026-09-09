

export type ModelSpeedRating = "fast" | "ok" | "good" | "excellent";

export type AioLocalModelStage =
  | "translation"
  | "detectText"
  | "recognizeText"
  | "segmentText"
  | "cleanImage"
  | "enhanceImage";

export type ModelInstallStrategy = "direct_download" | "backend_managed" | "manual_import";

export type ModelRuntimeFamily =
  | "onnx"
  | "onnx_bundle"
  | "enhance_onnx_bundle"
  | "pytorch_checkpoint"
  | "ctranslate2"
  | "gguf"
  | "safetensors_bundle"
  | "transformers_vlm"
  | "transformers_vlm_paddleocr_manga"
  | "managed_runtime";

export interface ModelArtifactFile {
  path: string;
  sha256?: string;
}

export type ModelInstallLifecycleStatus =
  | "not_installed"
  | "queued"
  | "downloading"
  | "verifying"
  | "installed"
  | "update_available"
  | "failed"
  | "cancelled"
  | "incomplete";

export type InstalledManifestStatus = "installed" | "incomplete";

export interface TranslationModelRequirements {
  gpu: boolean;
  vramMin: string;
  ramMin: string;
  diskSpace: string;
}

export interface TranslationModel {
  id: string;
  name: string;
  description: string;
  version: string;
  stage: AioLocalModelStage;
  sourceLanguages: string[];
  targetLanguages: string[];
  requirements: TranslationModelRequirements;
  speed: ModelSpeedRating;
  downloadUrl: string;
  checksumSHA256: string;
  fileSize: string;
  installStrategy?: ModelInstallStrategy;
  runtimeFamily?: ModelRuntimeFamily;
  backendInstallEndpoint?: string;
  docsUrl?: string;
  licenseNotes?: string;
  artifactManifest?: ModelArtifactFile[];
  recommended?: boolean;
  notes?: string;
  tooltipKey?: string;
}

export interface DiskSpaceInfo {
  freeBytes: number;
  totalBytes: number;
  path: string;
}

export interface InstalledModelRecord {
  modelId: string;
  version: string;
  installedAt: string;
  checksumSHA256: string;
  status: InstalledManifestStatus;
  installedLanguages?: string[];
  origin?: string | null;
  modelDir: string;
  manifestPath: string;
  sizeBytes: number;
}

export interface RemoteModelUpdateCheckResult {
  modelId: string;
  installedChecksumSHA256: string | null;
  remoteChecksumSHA256: string | null;
  registryVersion: string;
  checked: boolean;
  updateAvailable: boolean;
}

export interface ModelProgress {
  modelId: string;
  bytesDownloaded: number;
  totalBytes: number;
  speedBytesPerSecond: number;
  percent: number;
  attempt: number;
}

export interface ModelInstallState {
  model: TranslationModel;
  status: ModelInstallLifecycleStatus;
  installedVersion: string | null;
  availableVersion: string;
  installedAt: string | null;
  checksumSHA256: string | null;
  updateAvailable: boolean;
  error: string | null;
  errorCode: string | null;
  progress: ModelProgress | null;
  incomplete: boolean;
}

// Taxonomia espelha packages/mini-backend/core/download_jobs.py.
export type ModelDownloadErrorCode =
  | "network"
  | "disk_full"
  | "checksum_mismatch"
  | "rate_limited"
  | "cancelled"
  | "unknown";

export type ModelManagerEvent =
  | {
      type: "queued";
      modelId: string;
      queueLength: number;
    }
  | {
      type: "started";
      modelId: string;
      attempt: number;
    }
  | {
      type: "progress";
      modelId: string;
      bytesDownloaded: number;
      totalBytes: number;
      speedBytesPerSecond: number;
      percent: number;
      attempt: number;
    }
  | {
      type: "verifying";
      modelId: string;
    }
  | {
      type: "completed";
      modelId: string;
      version: string;
      installedAt: string;
    }
  | {
      type: "failed";
      modelId: string;
      message: string;
      attempt: number;
      willRetry: boolean;
      code?: ModelDownloadErrorCode;
    }
  | {
      type: "cancelled";
      modelId: string;
    };

export interface DesktopDownloadModelPayload {
  id: string;
  name: string;
  version: string;
  downloadUrl: string;
  checksumSHA256: string;
  expectedDownloadBytes: number;
  requiredDiskBytes: number;
  sourceLanguage?: string;
  installStrategy?: ModelInstallStrategy;
  runtimeFamily?: ModelRuntimeFamily;
  backendInstallEndpoint?: string;
}

export interface ModelFilterState {
  source: "all" | "local" | "cloud";
  language: string;
  status: "all" | "installed" | "not_installed" | "update_available";
}

export interface InstallAllSummary {
  totalBytes: number;
  requiredBytes: number;
  eligibleModelIds: string[];
}
