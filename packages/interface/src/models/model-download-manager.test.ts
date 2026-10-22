import { ModelDownloadManager } from "./model-download-manager";
import type { ModelManagerEvent, TranslationModel } from "./types";
import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";
import type { IDesktopBridge } from "@shared/desktop-api";
import { describe, it } from "vitest";

interface MockDesktopModelsApi {
  listInstalled: () => Promise<[]>;
  getDiskSpace: () => Promise<{ freeBytes: number; totalBytes: number; path: string }>;
  checkUpdates: (payloads: Array<unknown>) => Promise<Array<{
    modelId: string;
    installedChecksumSHA256: string | null;
    remoteChecksumSHA256: string | null;
    registryVersion: string;
    checked: boolean;
    updateAvailable: boolean;
  }>>;
  download: (payload: {
    id: string;
    name: string;
    version: string;
    downloadUrl: string;
    checksumSHA256: string;
    expectedDownloadBytes: number;
    requiredDiskBytes: number;
  }) => Promise<{ queued: boolean; queueLength: number }>;
  importOnnx: (payload: { id: string; name: string; version: string }) => Promise<{
    modelId: string;
    version: string;
    installedAt: string;
    checksumSHA256: string;
    status: "installed";
    modelDir: string;
    manifestPath: string;
    sizeBytes: number;
  }>;
  cancel: (modelId: string) => Promise<void>;
  cancelAll: () => Promise<void>;
  uninstall: (modelId: string) => Promise<void>;
  on: (listener: (event: ModelManagerEvent) => void) => void;
  off: (listener: (event: ModelManagerEvent) => void) => void;
}

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

export const runModelDownloadManagerMockTests = async (): Promise<void> => {
  const emitted: ModelManagerEvent[] = [];
  let attempts = 0;

  const listeners = new Set<(event: ModelManagerEvent) => void>();

  const mockDesktopModelsApi: MockDesktopModelsApi = {
    listInstalled: async () => [],
    getDiskSpace: async () => ({ freeBytes: 1024 ** 3, totalBytes: 1024 ** 3 * 10, path: "mock" }),
    checkUpdates: async () => [],
    download: async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("network error");
      }
      return { queued: true, queueLength: 1 };
    },
    importOnnx: async ({ id, version }) => ({
      modelId: id,
      version,
      installedAt: new Date().toISOString(),
      checksumSHA256: "0".repeat(64),
      status: "installed",
      modelDir: "mock",
      manifestPath: "mock/manifest.json",
      sizeBytes: 1,
    }),
    cancel: async () => {
      return;
    },
    cancelAll: async () => {
      return;
    },
    uninstall: async () => {
      return;
    },
    on: (listener) => {
      listeners.add(listener);
    },
    off: (listener) => {
      listeners.delete(listener);
    },
  };

  setDesktopBridgeProvider({
    desktop: { models: mockDesktopModelsApi } as unknown as IDesktopBridge,
  });

  try {
    const manager = new ModelDownloadManager();
    const unsubscribe = manager.subscribe((event) => {
      emitted.push(event);
    });

    await manager.enqueue(createMockModel("retry-model"));
    await new Promise((resolve) => {
      window.setTimeout(resolve, 900);
    });

    unsubscribe();

    if (attempts !== 3) {
      throw new Error(`Expected 3 attempts, got ${attempts}`);
    }

    const failedEvents = emitted.filter((event) => event.type === "failed");
    if (failedEvents.length < 2) {
      throw new Error("Expected failed events before retry success.");
    }
  } finally {
    setDesktopBridgeProvider(null);
  }
};

/**
 * A download that can never be queued must not wedge the model: the id is
 * released, so the next click reaches the bridge again instead of being
 * swallowed by the "already queued" guard with nothing reported.
 */
export const runFailedDownloadMockTests = async (): Promise<void> => {
  let attempts = 0;

  const listeners = new Set<(event: ModelManagerEvent) => void>();

  const mockDesktopModelsApi: MockDesktopModelsApi = {
    listInstalled: async () => [],
    getDiskSpace: async () => ({ freeBytes: 1024 ** 3, totalBytes: 1024 ** 3 * 10, path: "mock" }),
    checkUpdates: async () => [],
    download: async () => {
      attempts += 1;
      throw new Error("model provider refused the download");
    },
    importOnnx: async ({ id, version }) => ({
      modelId: id,
      version,
      installedAt: new Date().toISOString(),
      checksumSHA256: "0".repeat(64),
      status: "installed",
      modelDir: "mock",
      manifestPath: "mock/manifest.json",
      sizeBytes: 1,
    }),
    cancel: async () => {
      return;
    },
    cancelAll: async () => {
      return;
    },
    uninstall: async () => {
      return;
    },
    on: (listener) => {
      listeners.add(listener);
    },
    off: (listener) => {
      listeners.delete(listener);
    },
  };

  setDesktopBridgeProvider({
    desktop: { models: mockDesktopModelsApi } as unknown as IDesktopBridge,
  });

  // Read through a call so the assertion is not narrowed by the previous one:
  // a `let` counter compared inline gets narrowed to a literal by the compiler.
  const assertAttempts = (expected: number, scenario: string): void => {
    if (attempts !== expected) {
      throw new Error(`Expected ${expected} attempts ${scenario}, got ${attempts}`);
    }
  };

  const settle = async (): Promise<void> => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 900);
    });
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

describe("ModelDownloadManager desktop bridge", () => {
  it("retries a desktop download through the Tauri bridge override", async () => {
    await runModelDownloadManagerMockTests();
  });

  it("accepts a new enqueue after every attempt failed", async () => {
    await runFailedDownloadMockTests();
  });
});
