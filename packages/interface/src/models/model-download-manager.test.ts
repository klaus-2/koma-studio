import { ModelDownloadManager } from "./model-download-manager";
import type { ModelManagerEvent, TranslationModel } from "./types";
import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";
import { createDesktopBridgeStub } from "@/testing/desktop-bridge-stub";
import type { DesktopModelsApi } from "@shared/desktop-api";
import { describe, it } from "vitest";

type ModelManagerListener = Parameters<DesktopModelsApi["on"]>[0];

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

interface ManagerHarness {
  emitted: ModelManagerEvent[];
  listeners: Set<ModelManagerListener>;
  setDownload: (behavior: DesktopModelsApi["download"]) => void;
}

const createManagerHarness = (
  initial: { on?: DesktopModelsApi["on"] } = {},
): ManagerHarness => {
  const emitted: ModelManagerEvent[] = [];
  const listeners = new Set<ModelManagerListener>();
  let download: DesktopModelsApi["download"] = async () => ({ queued: true, queueLength: 1 });
  const on: DesktopModelsApi["on"] =
    initial.on ??
    (async (listener) => {
      listeners.add(listener);
      return true;
    });

  const backend: DesktopModelsApi = {
    listInstalled: async () => [],
    getDiskSpace: async () => ({ freeBytes: 1024 ** 3, totalBytes: 1024 ** 3 * 10, path: "mock" }),
    checkUpdates: async () => [],
    download: async (payload) => download(payload),
    importOnnx: async (payload) => ({
      modelId: payload.id,
      version: payload.version,
      installedAt: new Date().toISOString(),
      checksumSHA256: "0".repeat(64),
      status: "installed",
      modelDir: "mock",
      manifestPath: "mock/manifest.json",
      sizeBytes: 1,
    }),
    cancel: async () => undefined,
    cancelAll: async () => undefined,
    uninstall: async () => undefined,
    listActive: async () => ({ known: false }),
    on: (listener) => on(listener),
    off: (listener) => {
      listeners.delete(listener);
    },
  };

  setDesktopBridgeProvider({
    desktop: createDesktopBridgeStub(backend),
  });

  return {
    emitted,
    listeners,
    setDownload: (behavior) => {
      download = behavior;
    },
  };
};

const settle = async (): Promise<void> => {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 900);
  });
};

export const runModelDownloadManagerMockTests = async (): Promise<void> => {
  const harness = createManagerHarness();
  let attempts = 0;

  harness.setDownload(async () => {
    attempts += 1;
    if (attempts < 3) {
      throw new Error("network error");
    }
    return { queued: true, queueLength: 1 };
  });

  try {
    const manager = new ModelDownloadManager();
    const unsubscribe = manager.subscribe((event) => {
      harness.emitted.push(event);
    });

    await manager.enqueue(createMockModel("retry-model"));
    await settle();

    unsubscribe();

    if (attempts !== 3) {
      throw new Error(`Expected 3 attempts, got ${attempts}`);
    }

    const failedEvents = harness.emitted.filter((event) => event.type === "failed");
    if (failedEvents.length < 2) {
      throw new Error("Expected failed events before retry success.");
    }
  } finally {
    setDesktopBridgeProvider(null);
  }
};

export const runFailedDownloadMockTests = async (): Promise<void> => {
  const harness = createManagerHarness();
  let attempts = 0;

  harness.setDownload(async () => {
    attempts += 1;
    throw new Error("model provider refused the download");
  });

  // Read through a call so the assertion is not narrowed by the previous one:
  // a `let` counter compared inline gets narrowed to a literal by the compiler.
  const assertAttempts = (expected: number, scenario: string): void => {
    if (attempts !== expected) {
      throw new Error(`Expected ${expected} attempts ${scenario}, got ${attempts}`);
    }
  };

  try {
    const manager = new ModelDownloadManager();

    await manager.enqueue(createMockModel("refused-model"));
    await settle();
    assertAttempts(3, "for the first enqueue");

    await manager.enqueue(createMockModel("refused-model"));
    await settle();
    assertAttempts(6, "once the second enqueue reached the bridge again");
  } finally {
    setDesktopBridgeProvider(null);
  }
};

export const runMarkSettledTests = async (): Promise<void> => {
  const harness = createManagerHarness();
  let downloadCalls = 0;

  harness.setDownload(async () => {
    downloadCalls += 1;
    return { queued: true, queueLength: 1 };
  });

  try {
    const manager = new ModelDownloadManager();
    const model = createMockModel("settled-model");

    await manager.enqueue(model);
    await settle();
    if (!manager.queuedModelIds().has("settled-model")) {
      throw new Error("Expected the id to stay queued while no terminal event arrived.");
    }

    manager.markSettled("settled-model");
    if (manager.queuedModelIds().has("settled-model")) {
      throw new Error("Expected markSettled to release the id.");
    }

    await manager.enqueue(model);
    await settle();
    if (downloadCalls !== 2) {
      throw new Error(`Expected the re-enqueue to reach the bridge (2 calls), got ${downloadCalls}`);
    }
  } finally {
    setDesktopBridgeProvider(null);
  }
};

export const runBridgeSubscriptionRetryTests = async (): Promise<void> => {
  let subscriptionCalls = 0;
  let confirmSubscription = false;
  const confirmedListeners = new Set<ModelManagerListener>();

  createManagerHarness({
    on: (listener) => {
      subscriptionCalls += 1;
      if (confirmSubscription) {
        confirmedListeners.add(listener);
      }
      return Promise.resolve(confirmSubscription);
    },
  });

  const originalWarn = console.warn;
  console.warn = () => {};

  const subscriptionCallCount = (): number => subscriptionCalls;

  const emitCompleted = (): void => {
    confirmedListeners.forEach((listener) => {
      listener({
        type: "completed",
        modelId: "subscription-model",
        version: "1.0.0",
        installedAt: new Date().toISOString(),
      });
    });
  };

  try {
    const manager = new ModelDownloadManager();
    await settle();

    await manager.enqueue(createMockModel("subscription-model"));
    await settle();
    if (subscriptionCallCount() !== 2) {
      throw new Error(
        `Expected 2 subscription attempts (constructor + enqueue), got ${subscriptionCalls}`,
      );
    }

    emitCompleted();
    if (!manager.queuedModelIds().has("subscription-model")) {
      throw new Error("A refused subscription must not release queued ids.");
    }

    confirmSubscription = true;
    await manager.enqueue(createMockModel("subscription-model"));
    await settle();
    if (subscriptionCallCount() !== 3) {
      throw new Error(
        `Expected the enqueue to retry the subscription (3 attempts), got ${subscriptionCalls}`,
      );
    }

    emitCompleted();
    if (manager.queuedModelIds().has("subscription-model")) {
      throw new Error("A confirmed subscription must release the id on terminal events.");
    }
  } finally {
    console.warn = originalWarn;
    setDesktopBridgeProvider(null);
  }
};

describe("ModelDownloadManager desktop bridge", () => {
  it("retries a desktop download through the Tauri bridge override", async () => {
    await runModelDownloadManagerMockTests();
  });

  it("accepts a new enqueue after every attempt failed", async () => {
    await runFailedDownloadMockTests();
  });

  it("releases a settled id so the re-enqueue reaches the bridge", async () => {
    await runMarkSettledTests();
  });

  it("retries an unconfirmed bridge subscription on the next enqueue", async () => {
    await runBridgeSubscriptionRetryTests();
  });
});
