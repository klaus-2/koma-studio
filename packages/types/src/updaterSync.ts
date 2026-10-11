export type UpdaterSyncStepId = "pull" | "install" | "venv" | "build";

export type UpdaterSyncStepState = "pending" | "running" | "ok" | "failed" | "skipped";

export type UpdaterSyncPhase =
  | "idle"
  | "precheck"
  | "running"
  | "awaiting-rebuild"
  | "rebuilding"
  | "completed"
  | "failed";

export interface UpdaterSyncStepSnapshot {
  id: UpdaterSyncStepId;
  state: UpdaterSyncStepState;
}

export interface UpdaterSyncState {
  phase: UpdaterSyncPhase;
  steps: UpdaterSyncStepSnapshot[];
  dirtyFiles: string[];
  /** Rolling process log (stdout/stderr lines, oldest first). Capped. */
  logLines: string[];
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface UpdaterSyncEventPayload {
  state: UpdaterSyncState;
}

export type UpdaterSyncLogListener = (payload: UpdaterSyncEventPayload) => void;

export const UPDATER_SYNC_LOG_CAP = 800;

export const createInitialUpdaterSyncState = (): UpdaterSyncState => ({
  phase: "idle",
  steps: [
    { id: "pull", state: "pending" },
    { id: "install", state: "pending" },
    { id: "venv", state: "pending" },
    { id: "build", state: "pending" },
  ],
  dirtyFiles: [],
  logLines: [],
  error: null,
  startedAt: null,
  finishedAt: null,
});

export const UPDATER_SYNC_IPC = {
  start: "updater:sync-start",
  cancel: "updater:sync-cancel",
  rebuild: "updater:sync-rebuild",
  getStatus: "updater:sync-get-status",
  event: "updater:sync-event",
} as const;

/** Ordered step ids for snapshot normalization. */
export const UPDATER_SYNC_STEP_IDS: readonly UpdaterSyncStepId[] = ["pull", "install", "venv", "build"];

const isSyncStepId = (value: unknown): value is UpdaterSyncStepId =>
  typeof value === "string" && (UPDATER_SYNC_STEP_IDS as readonly string[]).includes(value);

const isSyncStepState = (value: unknown): value is UpdaterSyncStepState =>
  value === "pending" || value === "running" || value === "ok" || value === "failed" || value === "skipped";

const isSyncPhase = (value: unknown): value is UpdaterSyncPhase =>
  value === "idle" ||
  value === "precheck" ||
  value === "running" ||
  value === "awaiting-rebuild" ||
  value === "rebuilding" ||
  value === "completed" ||
  value === "failed";

export const parseUpdaterSyncState = (value: unknown): UpdaterSyncState | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (
    !isSyncPhase(payload.phase) ||
    !Array.isArray(payload.steps) ||
    !Array.isArray(payload.logLines) ||
    !Array.isArray(payload.dirtyFiles)
  ) {
    return null;
  }

  const stepsById = new Map<string, UpdaterSyncStepState>();
  for (const rawStep of payload.steps) {
    if (!rawStep || typeof rawStep !== "object") {
      continue;
    }
    const step = rawStep as Record<string, unknown>;
    if (isSyncStepId(step.id) && isSyncStepState(step.state)) {
      stepsById.set(step.id, step.state);
    }
  }

  const dirtyFiles = payload.dirtyFiles.filter(
    (entry): entry is string => typeof entry === "string",
  );
  const logLines = payload.logLines
    .filter((entry): entry is string => typeof entry === "string")
    .slice(-UPDATER_SYNC_LOG_CAP);

  return {
    phase: payload.phase,
    steps: UPDATER_SYNC_STEP_IDS.map((id) => ({
      id,
      state: stepsById.get(id) ?? "pending",
    })),
    dirtyFiles,
    logLines,
    error: typeof payload.error === "string" ? payload.error : null,
    startedAt: typeof payload.startedAt === "number" ? payload.startedAt : null,
    finishedAt: typeof payload.finishedAt === "number" ? payload.finishedAt : null,
  };
};
