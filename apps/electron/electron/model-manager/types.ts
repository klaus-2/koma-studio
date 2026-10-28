export interface DesktopDownloadModelPayload {
  id: string;
  name: string;
  version: string;
  downloadUrl: string;
  checksumSHA256: string;
  expectedDownloadBytes: number;
  requiredDiskBytes: number;
  sourceLanguage?: string;
  installStrategy?: "direct_download" | "backend_managed" | "manual_import";
  runtimeFamily?:
    | "onnx"
    | "onnx_bundle"
    | "enhance_onnx_bundle"
    | "pytorch_checkpoint"
    | "ctranslate2"
    | "transformers_vlm"
    | "transformers_vlm_paddleocr_manga"
    | "managed_runtime";
  backendInstallEndpoint?: string;
}

export interface DesktopDiskSpaceInfo {
  freeBytes: number;
  totalBytes: number;
  path: string;
}

export type DesktopModelManifestStatus = "installed" | "incomplete";

export interface DesktopInstalledModelRecord {
  modelId: string;
  version: string;
  installedAt: string;
  checksumSHA256: string;
  status: DesktopModelManifestStatus;
  installedLanguages?: string[];
  origin?: string | null;
  modelDir: string;
  manifestPath: string;
  sizeBytes: number;
}

export interface DesktopRemoteModelUpdateCheckResult {
  modelId: string;
  installedChecksumSHA256: string | null;
  remoteChecksumSHA256: string | null;
  registryVersion: string;
  checked: boolean;
  updateAvailable: boolean;
}

export type DesktopModelManagerEvent =
  | {
      type: "queued";
      modelId: string;
      queueLength?: number;
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
      /** Total bundle size; null when the backend cannot know it yet. */
      totalBytes: number | null;
      speedBytesPerSecond: number;
      /** null while the total is unknown — the UI renders an indeterminate state. */
      percent: number | null;
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

// Taxonomy mirrors packages/mini-backend/core/download_jobs.py.
export type ModelDownloadErrorCode =
  | "network"
  | "disk_full"
  | "checksum_mismatch"
  | "rate_limited"
  | "cancelled"
  | "unknown";

const MODEL_DOWNLOAD_ERROR_CODES: ReadonlySet<string> = new Set([
  "network",
  "disk_full",
  "checksum_mismatch",
  "rate_limited",
  "cancelled",
  "unknown",
]);

export const isModelDownloadErrorCode = (value: unknown): value is ModelDownloadErrorCode =>
  typeof value === "string" && MODEL_DOWNLOAD_ERROR_CODES.has(value);

export interface ModelDownloadJobSnapshot {
  jobId: string;
  modelId: string;
  state: "queued" | "downloading" | "verifying" | "ready" | "error" | "cancelled";
  bytesDownloaded: number;
  totalBytes: number | null;
  speedBytesPerSecond: number;
  percent: number;
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
}

export interface DesktopModelManifest {
  modelId: string;
  version: string;
  installedAt: string;
  checksumSHA256: string;
  status: DesktopModelManifestStatus;
  origin?: string;
}

export interface DownloadTask {
  model: DesktopDownloadModelPayload;
  enqueuedAt: number;
}
