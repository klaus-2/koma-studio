import type { ModelInstallLifecycleStatus, ModelInstallState } from "./types";

export interface ModelInstallReconciliation {
  entries: Record<string, ModelInstallState>;
  settledIds: string[];
}

const DISK_WITNESSED_STATUSES: ReadonlySet<ModelInstallLifecycleStatus> = new Set([
  "installed",
  "incomplete",
  "update_available",
]);

const IN_FLIGHT_STATUSES: ReadonlySet<ModelInstallLifecycleStatus> = new Set([
  "queued",
  "downloading",
  "verifying",
]);

export const reconcileModelInstallStates = (
  previousEntries: Record<string, ModelInstallState>,
  diskEntries: Record<string, ModelInstallState>,
  activeModelIds: ReadonlySet<string> | null,
  locallyQueuedIds: ReadonlySet<string>,
): ModelInstallReconciliation => {
  const entries: Record<string, ModelInstallState> = { ...diskEntries };
  const settledIds: string[] = [];

  Object.entries(previousEntries).forEach(([modelId, previousEntry]) => {
    if (!IN_FLIGHT_STATUSES.has(previousEntry.status)) {
      return;
    }

    const diskEntry = diskEntries[modelId];
    if (!diskEntry) {
      return;
    }

    if (activeModelIds === null || activeModelIds.has(modelId)) {
      entries[modelId] = {
        ...diskEntry,
        status: previousEntry.status,
        progress: previousEntry.progress,
        error: previousEntry.error,
        errorCode: previousEntry.errorCode,
      };
      return;
    }

    if (DISK_WITNESSED_STATUSES.has(diskEntry.status)) {
      entries[modelId] = diskEntry;
      settledIds.push(modelId);
      return;
    }

    if (locallyQueuedIds.has(modelId)) {
      entries[modelId] = {
        ...diskEntry,
        status: "queued",
      };
      return;
    }

    entries[modelId] = diskEntry;
    settledIds.push(modelId);
  });

  return { entries, settledIds };
};

export interface BatchProgress {
  total: number;
  completed: number;
  active: boolean;
  cancelled: boolean;
}

export const computeBatchProgress = (
  batch: { modelIds: readonly string[]; cancelled: boolean },
  entries: Readonly<Record<string, ModelInstallState>>,
): BatchProgress => {
  const completed = batch.modelIds.filter(
    (modelId) => !IN_FLIGHT_STATUSES.has(entries[modelId]?.status ?? "not_installed"),
  ).length;
  return {
    total: batch.modelIds.length,
    completed,
    active: completed < batch.modelIds.length && !batch.cancelled,
    cancelled: batch.cancelled,
  };
};
