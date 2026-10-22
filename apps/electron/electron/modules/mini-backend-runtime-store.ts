/**
 * Mini-backend runtime state store (status/progress + renderer event emit).
 */
import type { BrowserWindow } from "electron";
import type {
  MiniBackendAccelerationProfile,
  MiniBackendRuntimeSource,
} from "../mini-backend-runtime.ts";

type MiniBackendRuntimeStatus =
  | "idle"
  | "resolving"
  | "checking"
  | "downloading"
  | "verifying"
  | "extracting"
  | "ready"
  | "starting"
  | "fallback"
  | "crashed"
  | "error";

interface MiniBackendRuntimeProgressState {
  transferredBytes: number;
  totalBytes: number;
  percent: number;
  speedBytesPerSecond: number;
}

interface MiniBackendRuntimeState {
  status: MiniBackendRuntimeStatus;
  statusMessage: string | null;
  requestedProfile: MiniBackendAccelerationProfile;
  activeProfile: MiniBackendAccelerationProfile;
  source: MiniBackendRuntimeSource;
  runtimeArtifactsUrl: string | null;
  runtimeManifestUrl: string | null;
  runtimeArchiveUrl: string | null;
  installDir: string | null;
  downloadCacheDir: string | null;
  version: string | null;
  lastError: string | null;
  attempt: number;
  maxAttempts: number;
  /** Exit code of the last unexpected child exit, when it is known. */
  exitCode: number | null;
  /** Redacted tail (last 50 lines / 2000 chars) of the crashed child's stderr. */
  lastStderr: string | null;
  /** Crash post-mortem file, when the shell writes one. */
  crashLogPath: string | null;
  progress: MiniBackendRuntimeProgressState | null;
  updatedAt: number | null;
  gpuName: string | null;
  vramGb: number | null;
}

interface MiniBackendRuntimeStore {
  getState: () => MiniBackendRuntimeState;
  getSnapshot: () => MiniBackendRuntimeState;
  commit: (nextState: MiniBackendRuntimeState) => MiniBackendRuntimeState;
  patch: (patch: Partial<MiniBackendRuntimeState>) => MiniBackendRuntimeState;
}

const formatRuntimeBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const createMiniBackendRuntimeStore = (deps: {
  eventChannel: string;
  getMainWindow: () => BrowserWindow | null;
  initialState: MiniBackendRuntimeState;
}): MiniBackendRuntimeStore => {
  let miniBackendRuntimeState: MiniBackendRuntimeState = deps.initialState;

  const getSnapshot = (): MiniBackendRuntimeState => ({
    ...miniBackendRuntimeState,
    progress: miniBackendRuntimeState.progress ? { ...miniBackendRuntimeState.progress } : null,
  });

  const emitMiniBackendRuntimeState = (): void => {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send(deps.eventChannel, getSnapshot());
  };

  const commitMiniBackendRuntimeState = (
    nextState: MiniBackendRuntimeState,
  ): MiniBackendRuntimeState => {
    miniBackendRuntimeState = {
      ...nextState,
      progress: nextState.progress ? { ...nextState.progress } : null,
      updatedAt: Date.now(),
    };
    emitMiniBackendRuntimeState();
    return miniBackendRuntimeState;
  };

  const patchMiniBackendRuntimeState = (
    patch: Partial<MiniBackendRuntimeState>,
  ): MiniBackendRuntimeState =>
    commitMiniBackendRuntimeState({
      ...miniBackendRuntimeState,
      ...patch,
    });

  return {
    getState: () => miniBackendRuntimeState,
    getSnapshot,
    commit: commitMiniBackendRuntimeState,
    patch: patchMiniBackendRuntimeState,
  };
};

export type {
  MiniBackendRuntimeProgressState,
  MiniBackendRuntimeState,
  MiniBackendRuntimeStatus,
  MiniBackendRuntimeStore,
};
export { createMiniBackendRuntimeStore, formatRuntimeBytes };
