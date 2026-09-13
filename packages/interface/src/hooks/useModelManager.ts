import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { useI18n } from "../i18n";
import { getModelDownloadManager } from "../models/model-download-manager";
import {
  buildModelInstallStates,
  checkInstalledModelsAgainstSource,
  computeInstalledSizeBytes,
  estimateModelRequiredDiskBytes,
  getDiskSpace,
  listInstalledModels,
  summarizeInstalledModels,
  uninstallModelFromStorage,
} from "../models/model-storage";
import {
  modelSupportsLanguage,
  LOCAL_AIO_MODELS_BY_ID,
  LOCAL_AIO_MODELS_REGISTRY,
  TRANSLATION_MODELS_BY_ID,
  TRANSLATION_MODELS_REGISTRY,
} from "../models/translation-models-registry";
import type {
  DiskSpaceInfo,
  InstallAllSummary,
  ModelInstallState,
  ModelManagerEvent,
  TranslationModel,
} from "../models/types";
import { modelStore } from "../stores/model-store";

interface UseModelManagerOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

interface OpenModelManagerArgs {
  language?: string;
  focusedModelId?: string | null;
}

const getStoreSnapshot = () => modelStore.getState();

const patchEntry = (
  modelId: string,
  updater: (current: ModelInstallState) => ModelInstallState,
): void => {
  modelStore.setState((prev) => {
    const current = prev.entries[modelId];
    if (!current) {
      return prev;
    }

    return {
      ...prev,
      entries: {
        ...prev.entries,
        [modelId]: updater(current),
      },
    };
  });
};

const applyManagerEventToStore = (event: ModelManagerEvent): void => {
  if (event.type === "queued") {
    patchEntry(event.modelId, (current) => ({
      ...current,
      status: current.status === "downloading" ? "downloading" : "queued",
      error: null,
      errorCode: null,
      progress: current.status === "downloading" ? current.progress : null,
    }));
    return;
  }

  if (event.type === "started") {
    patchEntry(event.modelId, (current) => ({
      ...current,
      status: "downloading",
      error: null,
      errorCode: null,
      progress: current.progress ?? {
        modelId: event.modelId,
        bytesDownloaded: 0,
        totalBytes: Math.max(1, estimateModelRequiredDiskBytes(current.model)),
        speedBytesPerSecond: 0,
        percent: 0,
        attempt: event.attempt,
      },
    }));
    return;
  }

  if (event.type === "progress") {
    patchEntry(event.modelId, (current) => ({
      ...current,
      status: "downloading",
      error: null,
      errorCode: null,
      progress: {
        modelId: event.modelId,
        bytesDownloaded: event.bytesDownloaded,
        totalBytes: event.totalBytes,
        speedBytesPerSecond: event.speedBytesPerSecond,
        percent: event.percent,
        attempt: event.attempt,
      },
    }));
    return;
  }

  if (event.type === "verifying") {
    patchEntry(event.modelId, (current) => ({
      ...current,
      status: "verifying",
      error: null,
      errorCode: null,
    }));
    return;
  }

  if (event.type === "completed") {
    patchEntry(event.modelId, (current) => ({
      ...current,
      status: "installed",
      installedVersion: event.version,
      installedAt: event.installedAt,
      checksumSHA256: current.model.checksumSHA256,
      updateAvailable: false,
      progress: null,
      error: null,
      errorCode: null,
      incomplete: false,
    }));

    modelStore.setState((prev) => {
      if (!prev.batch.active) {
        return prev;
      }

      const completed = Math.min(prev.batch.total, prev.batch.completed + 1);
      return {
        ...prev,
        batch: {
          ...prev.batch,
          completed,
          active: completed < prev.batch.total && !prev.batch.cancelled,
        },
      };
    });
    return;
  }

  if (event.type === "failed") {
    patchEntry(event.modelId, (current) => ({
      ...current,
      status: "failed",
      progress: null,
      error: event.message,
      errorCode: event.code ?? null,
    }));

    if (!event.willRetry) {
      modelStore.setState((prev) => {
        if (!prev.batch.active) {
          return prev;
        }

        const completed = Math.min(prev.batch.total, prev.batch.completed + 1);
        return {
          ...prev,
          batch: {
            ...prev.batch,
            completed,
            active: completed < prev.batch.total && !prev.batch.cancelled,
          },
        };
      });
    }
    return;
  }

  patchEntry(event.modelId, (current) => ({
    ...current,
    status: "cancelled",
    progress: null,
    error: null,
    errorCode: null,
  }));

  modelStore.setState((prev) => {
    if (!prev.batch.active) {
      return prev;
    }

    const completed = Math.min(prev.batch.total, prev.batch.completed + 1);
    return {
      ...prev,
      batch: {
        ...prev.batch,
        completed,
        active: completed < prev.batch.total && !prev.batch.cancelled,
      },
    };
  });
};

const computeInstallAllSummary = (
  entries: Record<string, ModelInstallState>,
  modelIds?: string[],
): InstallAllSummary => {
  const allowedIds = modelIds ? new Set(modelIds) : null;
  const eligible = Object.values(entries).filter((entry) => {
    if (allowedIds && !allowedIds.has(entry.model.id)) {
      return false;
    }

    return (
      entry.status === "not_installed" ||
      entry.status === "update_available" ||
      entry.status === "failed" ||
      entry.status === "cancelled" ||
      entry.status === "incomplete"
    );
  });

  const totalBytes = eligible.reduce((acc, item) => acc + estimateModelRequiredDiskBytes(item.model), 0);

  return {
    totalBytes,
    requiredBytes: totalBytes,
    eligibleModelIds: eligible.map((item) => item.model.id),
  };
};

export const useModelManager = ({ sourceLanguage, targetLanguage }: UseModelManagerOptions) => {
  const { t } = useI18n();
  const state = useSyncExternalStore(modelStore.subscribe, getStoreSnapshot, getStoreSnapshot);

  const manager = useMemo(() => getModelDownloadManager(), []);

  const refreshModelState = useCallback(async (): Promise<void> => {
    modelStore.setState({ loading: true, error: null });
    try {
      const [installedModels, diskSpace] = await Promise.all([listInstalledModels(), getDiskSpace()]);
      const entries = buildModelInstallStates(
        LOCAL_AIO_MODELS_REGISTRY,
        installedModels,
        sourceLanguage,
      );

      modelStore.setState((prev) => {
        const mergedEntries: Record<string, ModelInstallState> = { ...entries };
        Object.entries(prev.entries).forEach(([modelId, previousEntry]) => {
          const nextEntry = mergedEntries[modelId];
          if (!nextEntry) {
            return;
          }

          const isInFlight =
            previousEntry.status === "queued" ||
            previousEntry.status === "downloading" ||
            previousEntry.status === "verifying";

          if (!isInFlight) {
            return;
          }

          mergedEntries[modelId] = {
            ...nextEntry,
            status: previousEntry.status,
            progress: previousEntry.progress,
            error: previousEntry.error,
            errorCode: previousEntry.errorCode,
          };
        });

        return {
          ...prev,
          entries: mergedEntries,
          installedSizeBytes: computeInstalledSizeBytes(installedModels),
          diskSpace,
          loading: false,
          initialized: true,
        };
      });
    } catch (error) {
      modelStore.setState({
        loading: false,
        initialized: true,
        error: error instanceof Error ? error.message : "Failed to load the installed models.",
      });
    }
  }, [sourceLanguage]);

  useEffect(() => {
    void refreshModelState();
  }, [refreshModelState]);

  useEffect(() => {
    const unsubscribe = manager.subscribe((event) => {
      applyManagerEventToStore(event);
      const shouldRefresh =
        event.type === "completed" ||
        event.type === "cancelled" ||
        (event.type === "failed" && !event.willRetry);
      if (shouldRefresh) {
        void refreshModelState();
      }
    });

    return unsubscribe;
  }, [manager, refreshModelState]);

  const refreshRemoteModelUpdates = useCallback(async (): Promise<void> => {
    modelStore.setState((prev) => ({ ...prev, checkingRemoteUpdates: true }));
    const currentEntries = modelStore.getState().entries;
    const installedModels: TranslationModel[] = [];
    for (const entry of Object.values(currentEntries)) {
      if (entry.status === "installed" || entry.status === "update_available") installedModels.push(entry.model);
    }
    if (installedModels.length === 0) {
      modelStore.setState((prev) => ({ ...prev, checkingRemoteUpdates: false, lastRemoteCheckAt: Date.now() }));
      return;
    }

    try {
      const results = await checkInstalledModelsAgainstSource(installedModels);
      if (results.length === 0) {
        modelStore.setState((prev) => ({ ...prev, checkingRemoteUpdates: false, lastRemoteCheckAt: Date.now() }));
        return;
      }

      const resultById = new Map(results.map((item) => [item.modelId, item]));

      modelStore.setState((prev) => {
        const nextEntries = { ...prev.entries };
        let changed = false;
        Object.entries(nextEntries).forEach(([modelId, entry]) => {
          const remote = resultById.get(modelId);
          if (!remote) {
            return;
          }

          const isBusy =
            entry.status === "queued" ||
            entry.status === "downloading" ||
            entry.status === "verifying";

          const nextUpdateAvailable = remote.updateAvailable;
          const nextStatus = isBusy
            ? entry.status
            : nextUpdateAvailable
              ? "update_available"
              : (entry.incomplete ? "incomplete" : "installed");

          if (entry.updateAvailable === nextUpdateAvailable && entry.status === nextStatus) {
            return;
          }

          changed = true;
          nextEntries[modelId] = {
            ...entry,
            updateAvailable: nextUpdateAvailable,
            status: nextStatus,
            availableVersion: remote.registryVersion,
          };
        });

        return {
          ...prev,
          entries: changed ? nextEntries : prev.entries,
          checkingRemoteUpdates: false,
          lastRemoteCheckAt: Date.now(),
        };
      });

    } catch {
      modelStore.setState((prev) => ({ ...prev, checkingRemoteUpdates: false, lastRemoteCheckAt: Date.now() }));
    }
  }, []);

  const openManager = useCallback((args?: OpenModelManagerArgs): void => {
    modelStore.setState((prev) => ({
      ...prev,
      modalOpen: true,
      modalLanguageFilter: args?.language ?? prev.modalLanguageFilter,
      focusedModelId: args?.focusedModelId ?? null,
    }));
  }, []);

  const closeManager = useCallback((): void => {
    modelStore.setState((prev) => ({
      ...prev,
      modalOpen: false,
      focusedModelId: null,
    }));
  }, []);

  const setModalLanguageFilter = useCallback((language: string): void => {
    modelStore.setState({ modalLanguageFilter: language });
  }, []);

  const refreshDiskSpace = useCallback(async (): Promise<DiskSpaceInfo | null> => {
    const nextDiskSpace = await getDiskSpace();
    modelStore.setState({ diskSpace: nextDiskSpace });
    return nextDiskSpace;
  }, []);

  const ensureEnoughDiskSpace = useCallback(
    async (requiredBytes: number): Promise<void> => {
      const diskSpace = state.diskSpace ?? (await refreshDiskSpace());
      if (!diskSpace) {
        throw new Error(t("modelManager.error.diskCheckFailed"));
      }

      if (diskSpace.freeBytes < requiredBytes) {
        throw new Error(
          `Not enough space. Required: ${(requiredBytes / 1024 ** 3).toFixed(1)} GB | Available: ${(diskSpace.freeBytes / 1024 ** 3).toFixed(1)} GB`,
        );
      }
    },
    [refreshDiskSpace, state.diskSpace, t],
  );

  const installModel = useCallback(
    async (modelId: string): Promise<void> => {
      const entry = modelStore.getState().entries[modelId];
      if (!entry) {
        throw new Error(t("modelManager.error.modelNotFound"));
      }
      await ensureEnoughDiskSpace(estimateModelRequiredDiskBytes(entry.model));
      await manager.enqueue(entry.model, sourceLanguage);
    },
    [ensureEnoughDiskSpace, manager, sourceLanguage, t],
  );

  const updateModel = useCallback(
    async (modelId: string): Promise<void> => {
      await installModel(modelId);
    },
    [installModel],
  );

  const uninstallModel = useCallback(async (modelId: string): Promise<void> => {
    await uninstallModelFromStorage(modelId);
    await refreshModelState();
  }, [refreshModelState]);

  const retryModel = useCallback(
    async (modelId: string): Promise<void> => {
      await installModel(modelId);
    },
    [installModel],
  );

  const cancelModel = useCallback(
    async (modelId: string): Promise<void> => {
      await manager.cancel(modelId);
    },
    [manager],
  );

  const installAllSummary = useMemo(
    () => computeInstallAllSummary(state.entries),
    [state.entries],
  );

  const installAll = useCallback(async (modelIds?: string[]): Promise<InstallAllSummary> => {
    const currentState = modelStore.getState();
    const summary = computeInstallAllSummary(currentState.entries, modelIds);
    if (summary.eligibleModelIds.length === 0) {
      return summary;
    }

    await ensureEnoughDiskSpace(summary.requiredBytes);

    modelStore.setState((prev) => ({
      ...prev,
      batch: {
        active: true,
        total: summary.eligibleModelIds.length,
        completed: 0,
        cancelled: false,
      },
    }));

    const models = summary.eligibleModelIds
      .map((modelId) => LOCAL_AIO_MODELS_BY_ID[modelId] ?? TRANSLATION_MODELS_BY_ID[modelId])
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    await manager.enqueueMany(models, sourceLanguage);
    return summary;
  }, [ensureEnoughDiskSpace, manager, sourceLanguage]);

  const cancelAll = useCallback(async (): Promise<void> => {
    await manager.cancelAll();
    modelStore.setState((prev) => ({
      ...prev,
      batch: {
        ...prev.batch,
        active: false,
        cancelled: true,
      },
    }));
  }, [manager]);

  const compatibleModels = useMemo(
    () =>
      TRANSLATION_MODELS_REGISTRY.filter((model) => modelSupportsLanguage(model, sourceLanguage, targetLanguage)),
    [sourceLanguage, targetLanguage],
  );

  const compatibleModelIds = useMemo(
    () => new Set(compatibleModels.map((model) => model.id)),
    [compatibleModels],
  );

  const summary = useMemo(() => summarizeInstalledModels(state.entries), [state.entries]);

  return {
    state,
    summary,
    compatibleModels,
    compatibleModelIds,
    installAllSummary,
    openManager,
    closeManager,
    setModalLanguageFilter,
    refreshModelState,
    refreshDiskSpace,
    installModel,
    updateModel,
    uninstallModel,
    retryModel,
    cancelModel,
    refreshRemoteModelUpdates,
    installAll,
    cancelAll,
  };
};
