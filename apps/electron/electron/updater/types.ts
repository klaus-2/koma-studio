export type UpdateProvider = "github" | "generic";
export type UpdateChannel = "stable" | "beta";

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export type UpdaterEventName =
  | "status"
  | "checking"
  | "available"
  | "not-available"
  | "progress"
  | "downloaded"
  | "error";

export interface UpdaterProgressState {
  percent: number;
  transferred: number;
  total: number;
  speed: number;
}

export interface UpdaterState {
  status: UpdaterStatus;
  currentVersion: string;
  newVersion: string | null;
  mandatory: boolean;
  blocking: boolean;
  blockingReason: "mandatory-update" | null;
  releaseNotes: string | null;
  channel: UpdateChannel;
  provider: UpdateProvider;
  autoInstallOnQuit: boolean;
  allowPrerelease: boolean;
  progress: UpdaterProgressState | null;
  checkedAt: number | null;
  downloadedAt: number | null;
  error: string | null;
}

export interface UpdaterEventPayload {
  event: UpdaterEventName;
  state: UpdaterState;
}
