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

// Keep the tests in milliseconds: the production poll cadence (200 ms) and
// dead-backend budget (150 polls) are far too slow for a unit test.
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

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

const modelDirOf = (userDataDir: string, modelId: string): string =>
  path.join(userDataDir, "models", modelId);

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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-models-"));
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
  // A dead backend is expected to log one warning per poll; keep the test
  // output readable without hiding anything from the service.
  console.warn = () => {};

  return {
    service,
    events,
    userDataDir,
    cleanup: () => {
      // Abort any download still looping (red state for the watchdog test)
      // so the test runner can drain the event loop and exit.
      service.cancelAllDownloads();
      globalThis.fetch = originalFetch;
      console.warn = originalWarn;
      fs.rmSync(userDataDir, { recursive: true, force: true });
    },
  };
};

test(
  "dead backend fails the download instead of hanging the queue",
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
        "terminal failure for the first model",
      );

      const secondModel: DesktopDownloadModelPayload = { ...TEST_MODEL, id: "second-model" };
      harness.service.enqueueDownload(secondModel);
      await waitForEvent(
        harness.events,
        (event) => event.type === "started" && event.modelId === secondModel.id,
        "second model start (queue must not stay latched)",
      );
      await waitForEvent(
        harness.events,
        (event) =>
          event.type === "failed" && event.modelId === secondModel.id && !event.willRetry,
        "terminal failure for the second model",
      );
    } finally {
      harness.cleanup();
    }
  },
);

test(
  "uninstall during a download does not resurrect the model directory",
  { timeout: 15_000 },
  async () => {
    const fetchImpl: FetchImpl = async (_input, init) => {
      if (init?.method === "POST") {
        return jsonResponse({ jobId: "job-1" });
      }
      return downloadSnapshot("downloading");
    };
    const harness = createHarness(fetchImpl);

    try {
      harness.service.enqueueDownload(TEST_MODEL);
      await waitForEvent(
        harness.events,
        (event) => event.type === "queued" && event.modelId === TEST_MODEL.id,
        "queued event",
      );

      harness.service.uninstallModel(TEST_MODEL.id);
      await waitForEvent(
        harness.events,
        (event) => event.type === "cancelled" && event.modelId === TEST_MODEL.id,
        "cancelled event",
      );
      await delay(1_000);

      assert.equal(
        fs.existsSync(modelDirOf(harness.userDataDir, TEST_MODEL.id)),
        false,
        "uninstalled model directory must stay removed",
      );
    } finally {
      harness.cleanup();
    }
  },
);

test(
  "a cancel between retry attempts stops the retry loop",
  { timeout: 15_000 },
  async () => {
    const fetchImpl: FetchImpl = async (_input, init) => {
      if (init?.method === "POST") {
        return jsonResponse({ jobId: "job-1" });
      }
      return downloadSnapshot("error", { errorCode: "network", errorMessage: "boom" });
    };

    let harness: ModelManagerHarness;
    let cancelIssued = false;
    harness = createHarness(fetchImpl, (event) => {
      if (
        event.type === "failed" &&
        event.modelId === TEST_MODEL.id &&
        event.willRetry &&
        !cancelIssued
      ) {
        cancelIssued = true;
        harness.service.cancelDownload(TEST_MODEL.id);
      }
    });

    try {
      harness.service.enqueueDownload(TEST_MODEL);
      await waitForEvent(
        harness.events,
        (event) =>
          (event.type === "cancelled" && event.modelId === TEST_MODEL.id) ||
          (event.type === "failed" && event.modelId === TEST_MODEL.id && !event.willRetry),
        "cancelled event or terminal failure",
      );

      const startedEvents = harness.events.filter(
        (event) => event.type === "started" && event.modelId === TEST_MODEL.id,
      );
      assert.equal(
        startedEvents.length,
        1,
        `cancel must be honored before the next attempt; saw ${startedEvents.length} started events`,
      );
      assert.ok(
        harness.events.some(
          (event) => event.type === "cancelled" && event.modelId === TEST_MODEL.id,
        ),
        "a cancelled event must follow the cancel request",
      );
    } finally {
      harness.cleanup();
    }
  },
);
