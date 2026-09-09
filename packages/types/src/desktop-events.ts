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
  currentVersion: string;
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

export type ModelManagerListener = (event: ModelManagerEvent) => void;

export type MiniBackendRuntimeStatus =
  | "idle"
  | "resolving"
  | "checking"
  | "downloading"
  | "verifying"
  | "extracting"
  | "ready"
  | "fallback"
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
  source: "bundled-core" | "downloaded-runtime";
  runtimeArtifactsUrl: string | null;
  runtimeManifestUrl: string | null;
  runtimeArchiveUrl: string | null;
  installDir: string | null;
  downloadCacheDir: string | null;
  version: string | null;
  lastError: string | null;
  attempt: number;
  maxAttempts: number;
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
