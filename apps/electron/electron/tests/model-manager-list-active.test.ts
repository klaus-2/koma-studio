import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import type { BrowserWindow } from "electron";
import type { ModelManagerEvent } from "../../../../packages/types/src/desktop-events.ts";
import {
  DesktopModelManagerService,
  type DesktopDownloadModelPayload,
} from "../model-manager.ts";

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface ModelManagerHarness {
  service: DesktopModelManagerService;
  events: ModelManagerEvent[];
  userDataDir: string;
  cleanup: () => void;
}

class TestModelManagerService extends DesktopModelManagerService {
  protected jobPollIntervalMs = 1;

  protected maxConsecutivePollFailures = 4;
}

const TEST_MODEL: DesktopDownloadModelPayload = {
  id: "test-model",
  name: "Test Model",
  version: "1.0.0",
  downloadUrl: "https://example.com/model.bin",
  checksumSHA256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  expectedDownloadBytes: 10,
  requiredDiskBytes: 10,
};

const jsonResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const downloadSnapshot = (state: string, extra: Record<string, unknown> = {}): Response =>
  jsonResponse({
    jobId: "job-1",
    modelId: TEST_MODEL.id,
    state,
    bytesDownloaded: 1,
    totalBytes: 10,
    speedBytesPerSecond: 1,
    percent: 10,
    ...extra,
  });

const neverResolvingSnapshot = (): Promise<Response> => new Promise<Response>(() => {});

const waitForEvent = (
  events: ModelManagerEvent[],
  predicate: (event: ModelManagerEvent) => boolean,
  label: string,
  timeoutMs = 10_000,
): Promise<ModelManagerEvent> =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const match = events.find(predicate);
      if (match) {
        clearInterval(timer);
        resolve(match);
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for ${label}. Events: ${JSON.stringify(events)}`));
      }
    }, 5);
  });

const createHarness = (
  fetchImpl: FetchImpl,
  onEvent?: (event: ModelManagerEvent) => void,
): ModelManagerHarness => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-models-active-"));
  const events: ModelManagerEvent[] = [];

  const windowStub = {
    isDestroyed: () => false,
    webContents: {
      send: (_channel: string, event: unknown) => {
        const typedEvent = event as ModelManagerEvent;
        events.push(typedEvent);
        onEvent?.(typedEvent);
      },
    },
  } as BrowserWindow;

  const service = new TestModelManagerService(
    () => userDataDir,
    () => windowStub,
    () => "http://127.0.0.1:9",
  );

  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  globalThis.fetch = fetchImpl;
  console.warn = () => {};

  return {
    service,
    events,
    userDataDir,
    cleanup: () => {
      service.cancelAllDownloads();
      globalThis.fetch = originalFetch;
      console.warn = originalWarn;
      fs.rmSync(userDataDir, { recursive: true, force: true });
    },
  };
};

test(
  "listActiveDownloadModelIds reports the in-flight download",
  { timeout: 15_000 },
  async () => {
    const fetchImpl: FetchImpl = async (_input, init) => {
      if (init?.method === "POST") {
        return jsonResponse({ jobId: "job-1" });
      }
      return neverResolvingSnapshot();
    };
    const harness = createHarness(fetchImpl);

    try {
      harness.service.enqueueDownload(TEST_MODEL);
      await waitForEvent(
        harness.events,
        (event) => event.type === "started" && event.modelId === TEST_MODEL.id,
        "started event",
      );

      assert.deepEqual(harness.service.listActiveDownloadModelIds(), [TEST_MODEL.id]);
    } finally {
      harness.cleanup();
    }
  },
);

test(
  "listActiveDownloadModelIds includes queued and in-flight models",
  { timeout: 15_000 },
  async () => {
    const secondModel: DesktopDownloadModelPayload = { ...TEST_MODEL, id: "second-model" };
    const fetchImpl: FetchImpl = async (_input, init) => {
      if (init?.method === "POST") {
        return jsonResponse({ jobId: "job-1" });
      }
      return neverResolvingSnapshot();
    };
    const harness = createHarness(fetchImpl);

    try {
      harness.service.enqueueDownload(TEST_MODEL);
      await waitForEvent(
        harness.events,
        (event) => event.type === "started" && event.modelId === TEST_MODEL.id,
        "started event for the first model",
      );

      harness.service.enqueueDownload(secondModel);

      assert.deepEqual(harness.service.listActiveDownloadModelIds(), [
        secondModel.id,
        TEST_MODEL.id,
      ]);
    } finally {
      harness.cleanup();
    }
  },
);

test(
  "listActiveDownloadModelIds empties after a terminal failure",
  { timeout: 15_000 },
  async () => {
    const fetchImpl: FetchImpl = async (_input, init) => {
      if (init?.method === "POST") {
        return jsonResponse({ jobId: "job-1" });
      }
      throw new TypeError("fetch failed");
    };
    const harness = createHarness(fetchImpl);

    try {
      harness.service.enqueueDownload(TEST_MODEL);
      await waitForEvent(
        harness.events,
        (event) =>
          event.type === "failed" && event.modelId === TEST_MODEL.id && !event.willRetry,
        "terminal failure",
      );

      assert.deepEqual(harness.service.listActiveDownloadModelIds(), []);
    } finally {
      harness.cleanup();
    }
  },
);

test(
  "listActiveDownloadModelIds keeps a retrying model present across attempts",
  { timeout: 15_000 },
  async () => {
    const fetchImpl: FetchImpl = async (_input, init) => {
      if (init?.method === "POST") {
        return jsonResponse({ jobId: "job-1" });
      }
      return downloadSnapshot("error", { errorCode: "network", errorMessage: "boom" });
    };

    const retryActiveSnapshots: string[][] = [];
    let harness: ModelManagerHarness;
    harness = createHarness(fetchImpl, (event) => {
      if (event.type === "started" && event.modelId === TEST_MODEL.id && event.attempt > 1) {
        retryActiveSnapshots.push(harness.service.listActiveDownloadModelIds());
      }
    });

    try {
      harness.service.enqueueDownload(TEST_MODEL);
      await waitForEvent(
        harness.events,
        (event) =>
          event.type === "started" && event.modelId === TEST_MODEL.id && event.attempt > 1,
        "started event for the retry attempt",
      );

      assert.ok(retryActiveSnapshots.length > 0, "a retry attempt must have started");
      assert.deepEqual(retryActiveSnapshots[0], [TEST_MODEL.id]);
    } finally {
      harness.cleanup();
    }
  },
);
