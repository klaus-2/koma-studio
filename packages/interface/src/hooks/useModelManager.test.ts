import { beforeEach, describe, expect, it } from "vitest";

import type {
  ModelInstallLifecycleStatus,
  ModelInstallState,
  ModelProgress,
  TranslationModel,
} from "../models/types";
import { modelStore } from "../stores/model-store";
import { getModelManagerStatusSnapshot } from "./useModelManager";

const MODEL: TranslationModel = {
  id: "test-model",
  name: "Test Model",
  description: "Snapshot selector fixture.",
  version: "1.0.0",
  stage: "translation",
  sourceLanguages: ["en"],
  targetLanguages: ["pt"],
  requirements: {
    gpu: false,
    vramMin: "0 GB",
    ramMin: "1 GB",
    diskSpace: "10 MB",
  },
  speed: "fast",
  downloadUrl: "https://example.invalid/model.bin",
  checksumSHA256: "0",
  fileSize: "10 MB",
};

const buildProgress = (percent: number): ModelProgress => ({
  modelId: MODEL.id,
  bytesDownloaded: percent * 10,
  totalBytes: 1000,
  speedBytesPerSecond: 100,
  percent,
  attempt: 1,
});

const buildEntry = (
  status: ModelInstallLifecycleStatus,
  progress: ModelProgress | null,
): ModelInstallState => ({
  model: MODEL,
  status,
  installedVersion: status === "installed" ? MODEL.version : null,
  availableVersion: MODEL.version,
  installedAt: null,
  checksumSHA256: null,
  updateAvailable: status === "update_available",
  error: null,
  errorCode: null,
  progress,
  incomplete: false,
});

const setEntry = (entry: ModelInstallState): void => {
  modelStore.setState({ entries: { [MODEL.id]: entry } });
};

describe("getModelManagerStatusSnapshot", () => {
  beforeEach(() => {
    modelStore.reset();
  });

  it("keeps the snapshot identity when only download progress changes", () => {
    setEntry(buildEntry("downloading", buildProgress(10)));
    const first = getModelManagerStatusSnapshot();

    setEntry(buildEntry("downloading", buildProgress(55)));
    const second = getModelManagerStatusSnapshot();

    expect(second).toBe(first);
    expect(second.entries[MODEL.id]?.progress?.percent).toBe(10);
  });

  it("returns a new snapshot when an entry status flips", () => {
    setEntry(buildEntry("downloading", buildProgress(99)));
    const first = getModelManagerStatusSnapshot();

    setEntry(buildEntry("installed", null));
    const second = getModelManagerStatusSnapshot();

    expect(second).not.toBe(first);
    expect(second.entries[MODEL.id]?.status).toBe("installed");
    expect(second.entries[MODEL.id]?.progress).toBeNull();
  });
});
