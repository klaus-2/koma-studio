export const updaterEventNames = [
  "status",
  "checking",
  "available",
  "not-available",
  "progress",
  "downloaded",
  "error",
] as const;

export type UpdaterEventName = (typeof updaterEventNames)[number];

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdaterProgressPayload {
  percent: number;
  transferred: number;
  total: number;
  speed: number;
}

export interface UpdaterStatusPayload {
  status: UpdaterStatus;
  // null = no installed shell version, so the updater has no baseline and must not run.
  currentVersion: string | null;
  newVersion: string | null;
  mandatory: boolean;
  blocking: boolean;
  blockingReason: "mandatory-update" | null;
  releaseNotes: string | null;
  channel: "stable" | "beta";
  provider: "github" | "generic";
  autoInstallOnQuit: boolean;
  allowPrerelease: boolean;
  progress: UpdaterProgressPayload | null;
  checkedAt: number | null;
  downloadedAt: number | null;
  error: string | null;
}

// Named aliases used by the interface (previously defined in
// apps/tauri/interface/types/index.ts — consolidated here).
export type UpdaterProvider = UpdaterStatusPayload["provider"];
export type UpdaterChannel = UpdaterStatusPayload["channel"];
export type UpdaterProgress = UpdaterProgressPayload;
export type UpdaterState = UpdaterStatusPayload;

export interface UpdaterEventPayload {
  event: UpdaterEventName;
  state: UpdaterStatusPayload;
}

export type UpdaterListener = (payload: UpdaterEventPayload) => void;

// Model download error taxonomy (authority: mini-backend
// core/download_jobs.py classify_error). The UI resolves a friendly message
// via i18n (modelManager.downloadError.<code>).
export const modelDownloadErrorCodes = [
  "network",
  "disk_full",
  "checksum_mismatch",
  "rate_limited",
  "cancelled",
  "unknown",
] as const;

export type ModelDownloadErrorCode = (typeof modelDownloadErrorCodes)[number];

const MODEL_DOWNLOAD_ERROR_CODES: ReadonlySet<string> = new Set(modelDownloadErrorCodes);

export const isModelDownloadErrorCode = (
  value: unknown,
): value is ModelDownloadErrorCode =>
  typeof value === "string" && MODEL_DOWNLOAD_ERROR_CODES.has(value);

export type ModelManagerEvent =
  | {
      type: "queued";
      modelId: string;
      /** How many jobs are ahead in the backend queue; unknown for shells that cannot tell. */
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

export type ModelManagerListener = (event: ModelManagerEvent) => void;

export type MiniBackendRuntimeStatus =
  | "idle"
  | "resolving"
  | "checking"
  | "downloading"
  | "verifying"
  | "extracting"
  | "starting"
  | "ready"
  | "fallback"
  | "crashed"
  | "error";

export interface MiniBackendRuntimeProgressPayload {
  transferredBytes: number;
  totalBytes: number;
  percent: number;
  speedBytesPerSecond: number;
}

export interface MiniBackendRuntimeStatePayload {
  status: MiniBackendRuntimeStatus;
  statusMessage: string | null;
  requestedProfile: string;
  activeProfile: string;
  source: "bundled-core" | "downloaded-runtime" | "no-runtime-installed";
  runtimeArtifactsUrl: string | null;
  runtimeManifestUrl: string | null;
  runtimeArchiveUrl: string | null;
  installDir: string | null;
  downloadCacheDir: string | null;
  version: string | null;
  lastError: string | null;
  attempt: number;
  maxAttempts: number;
  exitCode: number | null;
  lastStderr: string | null;
  crashLogPath: string | null;
  progress: MiniBackendRuntimeProgressPayload | null;
  updatedAt: number | null;
  gpuName: string | null;
  vramGb: number | null;
}

export type MiniBackendRuntimeListener = (
  state: MiniBackendRuntimeStatePayload,
) => void;

export interface MiniBackendRuntimeArtifactOptionPayload {
  profile: string;
  version: string;
  size: number;
  installed: boolean;
  recommended: boolean;
}

export interface DesktopShortcutEventPayload {
  actionId: string;
}

export interface DesktopEventPayloadMap {
  "updater:event": UpdaterEventPayload;
  "model-manager:event": ModelManagerEvent;
  "mini-backend-runtime:event": MiniBackendRuntimeStatePayload;
  "desktop:shortcut-action": DesktopShortcutEventPayload;
  "koma-desktop-shortcut": DesktopShortcutEventPayload;
}

export type DesktopEventName = keyof DesktopEventPayloadMap;
