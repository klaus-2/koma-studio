import { act, renderHook } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { I18nProvider } from "@/i18n";
import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";
import type { IDesktopBridge } from "@shared/desktop-api";
import { getModelDownloadManager } from "../models/model-download-manager";
import { LOCAL_AIO_MODELS_BY_ID } from "../models/translation-models-registry";
import type {
  InstalledModelRecord,
  ModelInstallLifecycleStatus,
  ModelInstallState,
  ModelManagerEvent,
  ModelProgress,
  TranslationModel,
} from "../models/types";
import { modelStore } from "../stores/model-store";
import { useModelManager } from "./useModelManager";

const MODEL_ID = "nllb-200-600m-int8";

const registryModel = (): TranslationModel => {
  const model = LOCAL_AIO_MODELS_BY_ID[MODEL_ID];
  if (!model) {
    throw new Error(`registry fixture model ${MODEL_ID} is missing`);
  }
  return model;
};

let installedModels: InstalledModelRecord[] = [];
let activeModelIds: string[] | null = null;
let listInstalledCalls = 0;
let bridgeListener: ((event: ModelManagerEvent) => void) | null = null;

beforeAll(() => {
  setDesktopBridgeProvider({
    desktop: {
      models: {
        listInstalled: async () => {
          listInstalledCalls += 1;
          return installedModels;
        },
        getDiskSpace: async () => ({
          freeBytes: 1024 ** 3,
          totalBytes: 1024 ** 3 * 10,
          path: "mock",
        }),
        checkUpdates: async () => [],
        download: async () => ({ queued: true, queueLength: 1 }),
        importOnnx: async () => {
          throw new Error("not used in this suite");
        },
        cancel: async () => undefined,
        cancelAll: async () => undefined,
        uninstall: async () => undefined,
        listActive: async () => activeModelIds,
        on: (listener: (event: ModelManagerEvent) => void) => {
          bridgeListener = listener;
          return Promise.resolve(true);
        },
        off: () => undefined,
      },
    } as unknown as IDesktopBridge,
  });
});

const emitBridgeEvent = (event: ModelManagerEvent): void => {
  if (!bridgeListener) {
    throw new Error("the manager has not subscribed to the bridge yet");
  }
  bridgeListener(event);
};

const buildProgress = (model: TranslationModel): ModelProgress => ({
  modelId: model.id,
  bytesDownloaded: 256,
  totalBytes: 1024,
  speedBytesPerSecond: 64,
  percent: 25,
  attempt: 1,
});

const buildEntry = (
  model: TranslationModel,
  status: ModelInstallLifecycleStatus,
  progress: ModelProgress | null,
): ModelInstallState => ({
  model,
  status,
  installedVersion: null,
  availableVersion: model.version,
  installedAt: null,
  checksumSHA256: null,
  updateAvailable: false,
  error: null,
  errorCode: null,
  progress,
  incomplete: false,
});

const buildInstalledRecord = (model: TranslationModel): InstalledModelRecord => ({
  modelId: model.id,
  version: model.version,
  installedAt: "2026-11-03T00:00:00.000Z",
  checksumSHA256: model.checksumSHA256,
  status: "installed",
  modelDir: "mock",
  manifestPath: "mock/manifest.json",
  sizeBytes: 1024,
});

const seedDownloadingEntry = (batchActive: boolean): void => {
  modelStore.setState({
    entries: {
      [MODEL_ID]: buildEntry(registryModel(), "downloading", buildProgress(registryModel())),
    },
    batch: {
      active: batchActive,
      total: 1,
      completed: 0,
      cancelled: false,
      countedModelIds: [],
    },
  });
};

const flushAsyncWork = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
};

const renderManager = () =>
  renderHook(() => useModelManager({ sourceLanguage: "ja", targetLanguage: "en" }), {
    wrapper: I18nProvider,
  });

describe("useModelManager reconciliation", () => {
  beforeEach(() => {
    installedModels = [];
    activeModelIds = null;
    listInstalledCalls = 0;
    modelStore.reset();
  });

  it("adopts the installed disk state and counts the batch once the shell goes idle", async () => {
    installedModels = [buildInstalledRecord(registryModel())];
    activeModelIds = [];
    seedDownloadingEntry(true);

    const { result } = renderManager();
    await act(async () => {
      await result.current.refreshModelState();
    });

    expect(modelStore.getState().entries[MODEL_ID]?.status).toBe("installed");
    expect(getModelDownloadManager().queuedModelIds().has(MODEL_ID)).toBe(false);
    expect(modelStore.getState().batch.completed).toBe(1);
    expect(modelStore.getState().batch.countedModelIds).toEqual([MODEL_ID]);
  });

  it("keeps the download in flight while the shell still reports activity", async () => {
    installedModels = [buildInstalledRecord(registryModel())];
    activeModelIds = [MODEL_ID];
    seedDownloadingEntry(true);

    const { result } = renderManager();
    await act(async () => {
      await result.current.refreshModelState();
    });

    const entry = modelStore.getState().entries[MODEL_ID];
    expect(entry?.status).toBe("downloading");
    expect(entry?.progress?.percent).toBe(25);
    expect(modelStore.getState().batch.completed).toBe(0);
  });

  it("counts a settled model exactly once across repeated refreshes", async () => {
    installedModels = [buildInstalledRecord(registryModel())];
    activeModelIds = [];
    seedDownloadingEntry(true);

    const { result } = renderManager();
    await act(async () => {
      await result.current.refreshModelState();
    });
    await act(async () => {
      await result.current.refreshModelState();
    });

    expect(modelStore.getState().batch.completed).toBe(1);
    expect(modelStore.getState().batch.countedModelIds).toEqual([MODEL_ID]);
  });

  it("keeps the download in flight and settles nothing when the shell truth is unknown", async () => {
    installedModels = [buildInstalledRecord(registryModel())];
    activeModelIds = null;
    seedDownloadingEntry(true);

    const { result } = renderManager();
    await act(async () => {
      await result.current.refreshModelState();
    });

    const entry = modelStore.getState().entries[MODEL_ID];
    expect(entry?.status).toBe("downloading");
    expect(entry?.progress?.percent).toBe(25);
    expect(modelStore.getState().batch.completed).toBe(0);
    expect(modelStore.getState().batch.countedModelIds).toEqual([]);
  });

  it("does not double-count when a stale terminal event races the reconciliation", async () => {
    installedModels = [buildInstalledRecord(registryModel())];
    activeModelIds = [MODEL_ID];
    seedDownloadingEntry(true);

    const { result } = renderManager();
    await flushAsyncWork();

    emitBridgeEvent({
      type: "completed",
      modelId: MODEL_ID,
      version: registryModel().version,
      installedAt: "2026-11-03T00:00:00.000Z",
    });
    expect(modelStore.getState().batch.completed).toBe(1);
    expect(modelStore.getState().batch.countedModelIds).toEqual([MODEL_ID]);

    modelStore.setState({
      entries: {
        [MODEL_ID]: buildEntry(registryModel(), "downloading", buildProgress(registryModel())),
      },
    });
    activeModelIds = [];

    await act(async () => {
      await result.current.refreshModelState();
    });

    expect(modelStore.getState().batch.completed).toBe(1);
    expect(modelStore.getState().batch.countedModelIds).toEqual([MODEL_ID]);
    expect(modelStore.getState().entries[MODEL_ID]?.status).toBe("installed");
  });

  it("refreshes the model state when the manager opens", async () => {
    registryModel();
    const { result } = renderManager();
    await flushAsyncWork();

    const callsBefore = listInstalledCalls;
    await act(async () => {
      result.current.openManager();
    });
    const callsAfter = listInstalledCalls;

    expect(modelStore.getState().modalOpen).toBe(true);
    expect(callsAfter).toBe(callsBefore + 1);
  });
});
