import { describe, expect, it } from "vitest";

import { computeBatchProgress, reconcileModelInstallStates } from "./model-install-reconciliation";
import type {
  ModelInstallLifecycleStatus,
  ModelInstallState,
  ModelProgress,
  TranslationModel,
} from "./types";

const createMockModel = (id: string): TranslationModel => ({
  id,
  name: id,
  description: "mock",
  version: "1.0.0",
  stage: "translation",
  sourceLanguages: ["ja"],
  targetLanguages: ["en"],
  requirements: {
    gpu: false,
    vramMin: "0",
    ramMin: "4GB",
    diskSpace: "100MB",
  },
  speed: "fast",
  downloadUrl: "https://example.com/mock.bin",
  checksumSHA256: "54e50d7b19c16883541a0f42f2f2be3617c6597457d8a29f86dc6f5d130f8f2d",
  fileSize: "100MB",
});

const buildInstallState = (
  model: TranslationModel,
  status: ModelInstallLifecycleStatus,
  overrides: Partial<ModelInstallState> = {},
): ModelInstallState => ({
  model,
  status,
  installedVersion: null,
  availableVersion: model.version,
  installedAt: null,
  checksumSHA256: null,
  updateAvailable: status === "update_available",
  error: null,
  errorCode: null,
  progress: null,
  incomplete: status === "incomplete",
  ...overrides,
});

const buildDownloadingProgress = (modelId: string): ModelProgress => ({
  modelId,
  bytesDownloaded: 1024,
  totalBytes: 4096,
  speedBytesPerSecond: 512,
  percent: 25,
  attempt: 1,
});

describe("reconcileModelInstallStates", () => {
  it("keeps an in-flight entry when the shell still reports activity", () => {
    const model = createMockModel("model-a");
    const previous = buildInstallState(model, "downloading", {
      progress: buildDownloadingProgress("model-a"),
    });
    const disk = buildInstallState(model, "installed", {
      installedVersion: "1.0.0",
      installedAt: "2026-11-03T00:00:00.000Z",
      checksumSHA256: "a".repeat(64),
    });

    const result = reconcileModelInstallStates(
      { "model-a": previous },
      { "model-a": disk },
      new Set<string>(["model-a"]),
      new Set<string>(),
    );

    const reconciled = result.entries["model-a"];
    expect(reconciled?.status).toBe("downloading");
    expect(reconciled?.progress).toEqual(buildDownloadingProgress("model-a"));
    expect(result.settledIds).toEqual([]);
  });

  it("adopts an installed disk entry and settles the model when the shell is idle", () => {
    const model = createMockModel("model-b");
    const previous = buildInstallState(model, "downloading", {
      progress: buildDownloadingProgress("model-b"),
    });
    const disk = buildInstallState(model, "installed", {
      installedVersion: "1.0.0",
      installedAt: "2026-11-03T00:00:00.000Z",
      checksumSHA256: "b".repeat(64),
    });

    const result = reconcileModelInstallStates(
      { "model-b": previous },
      { "model-b": disk },
      new Set<string>(),
      new Set<string>(["model-b"]),
    );

    expect(result.entries["model-b"]).toBe(disk);
    expect(result.settledIds).toEqual(["model-b"]);
  });

  it("adopts an incomplete disk entry and settles the model when the shell is idle", () => {
    const model = createMockModel("model-c");
    const previous = buildInstallState(model, "verifying");
    const disk = buildInstallState(model, "incomplete", {
      incomplete: true,
    });

    const result = reconcileModelInstallStates(
      { "model-c": previous },
      { "model-c": disk },
      new Set<string>(),
      new Set<string>(),
    );

    expect(result.entries["model-c"]).toBe(disk);
    expect(result.settledIds).toEqual(["model-c"]);
  });

  it("keeps a locally queued entry when the disk has no witness", () => {
    const model = createMockModel("model-d");
    const previous = buildInstallState(model, "queued");
    const disk = buildInstallState(model, "not_installed");

    const result = reconcileModelInstallStates(
      { "model-d": previous },
      { "model-d": disk },
      new Set<string>(),
      new Set<string>(["model-d"]),
    );

    expect(result.entries["model-d"]?.status).toBe("queued");
    expect(result.settledIds).toEqual([]);
  });

  it("adopts not_installed and settles an in-flight entry nothing else holds", () => {
    const model = createMockModel("model-e");
    const previous = buildInstallState(model, "downloading", {
      progress: buildDownloadingProgress("model-e"),
    });
    const disk = buildInstallState(model, "not_installed");

    const result = reconcileModelInstallStates(
      { "model-e": previous },
      { "model-e": disk },
      new Set<string>(),
      new Set<string>(),
    );

    expect(result.entries["model-e"]).toBe(disk);
    expect(result.settledIds).toEqual(["model-e"]);
  });

  it("lets the disk win for entries that are not in flight", () => {
    const model = createMockModel("model-f");
    const previous = buildInstallState(model, "failed", {
      error: "network error",
      errorCode: "network",
    });
    const disk = buildInstallState(model, "installed", {
      installedVersion: "1.0.0",
      installedAt: "2026-11-03T00:00:00.000Z",
      checksumSHA256: "f".repeat(64),
    });

    const result = reconcileModelInstallStates(
      { "model-f": previous },
      { "model-f": disk },
      new Set<string>(),
      new Set<string>(),
    );

    expect(result.entries["model-f"]).toBe(disk);
    expect(result.settledIds).toEqual([]);
  });

  it("preserves every in-flight entry without settling when the shell truth is unknown", () => {
    const model = createMockModel("model-null");
    const previous = buildInstallState(model, "downloading", {
      progress: buildDownloadingProgress("model-null"),
    });
    const disk = buildInstallState(model, "not_installed");

    const result = reconcileModelInstallStates(
      { "model-null": previous },
      { "model-null": disk },
      null,
      new Set<string>(["model-null"]),
    );

    expect(result.entries["model-null"]?.status).toBe("downloading");
    expect(result.entries["model-null"]?.progress).toEqual(buildDownloadingProgress("model-null"));
    expect(result.settledIds).toEqual([]);
  });

  it("settles every eligible adoption across multiple models", () => {
    const modelOne = createMockModel("model-g1");
    const modelTwo = createMockModel("model-g2");
    const modelThree = createMockModel("model-g3");
    const diskEntries: Record<string, ModelInstallState> = {
      "model-g1": buildInstallState(modelOne, "installed", {
        installedVersion: "1.0.0",
        installedAt: "2026-11-03T00:00:00.000Z",
        checksumSHA256: "1".repeat(64),
      }),
      "model-g2": buildInstallState(modelTwo, "incomplete", {
        incomplete: true,
      }),
      "model-g3": buildInstallState(modelThree, "not_installed"),
    };
    const previousEntries: Record<string, ModelInstallState> = {
      "model-g1": buildInstallState(modelOne, "downloading"),
      "model-g2": buildInstallState(modelTwo, "verifying"),
      "model-g3": buildInstallState(modelThree, "queued"),
    };

    const result = reconcileModelInstallStates(
      previousEntries,
      diskEntries,
      new Set<string>(),
      new Set<string>(),
    );

    expect(result.settledIds).toEqual(["model-g1", "model-g2", "model-g3"]);
  });
});

describe("computeBatchProgress", () => {
  const model = createMockModel("batch-model");

  it("derives the settled count from the entry statuses", () => {
    const entries: Record<string, ModelInstallState> = {
      "batch-model": buildInstallState(model, "installed"),
      "other-model": buildInstallState(createMockModel("other-model"), "downloading"),
    };

    const progress = computeBatchProgress(
      { modelIds: ["batch-model", "other-model"], cancelled: false },
      entries,
    );

    expect(progress).toEqual({ total: 2, completed: 1, active: true, cancelled: false });
  });

  it("closes the batch once every model settles or the batch is cancelled", () => {
    const entries: Record<string, ModelInstallState> = {
      "batch-model": buildInstallState(model, "installed"),
    };

    expect(
      computeBatchProgress({ modelIds: ["batch-model"], cancelled: false }, entries),
    ).toEqual({ total: 1, completed: 1, active: false, cancelled: false });
    expect(
      computeBatchProgress({ modelIds: ["batch-model"], cancelled: true }, entries).active,
    ).toBe(false);
  });

  it("counts models missing from the entries map as settled", () => {
    const progress = computeBatchProgress({ modelIds: ["gone-model"], cancelled: false }, {});

    expect(progress).toEqual({ total: 1, completed: 1, active: false, cancelled: false });
  });
});
