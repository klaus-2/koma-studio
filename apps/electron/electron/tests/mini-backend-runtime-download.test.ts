import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  downloadResponseToFile,
  downloadUrlToFileWithResume,
  estimateRuntimeInstallRequiredBytes,
  resolveExistingPathForStatfs,
  resolveRuntimeTransferTimeoutMs,
  runWithRetry,
  type RuntimeDownloadProgress,
} from "../mini-backend-runtime-download.ts";

const createTempFilePath = (fileName: string): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-runtime-test-"));
  return path.join(tempDir, fileName);
};

test("estimateRuntimeInstallRequiredBytes reserves space for download, extract, and final install", () => {
  assert.equal(estimateRuntimeInstallRequiredBytes(0), 512 * 1024 * 1024);
  assert.equal(estimateRuntimeInstallRequiredBytes(1024), 512 * 1024 * 1024);
  assert.equal(estimateRuntimeInstallRequiredBytes(4 * 1024 * 1024 * 1024), 12 * 1024 * 1024 * 1024);
});

test("downloadResponseToFile uses fallback size when content-length is unavailable and emits progress", async () => {
  const outputPath = createTempFilePath("runtime.zip");
  const events: RuntimeDownloadProgress[] = [];
  let nowMs = 0;

  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.from([1, 2]));
        controller.enqueue(Uint8Array.from([3, 4]));
        controller.close();
      },
    }),
    {
      status: 200,
    },
  );

  const finalProgress = await downloadResponseToFile(response, outputPath, {
    fallbackTotalBytes: 4,
    now: () => {
      nowMs += 100;
      return nowMs;
    },
    onProgress: (event) => {
      events.push(event);
    },
  });

  assert.equal(fs.readFileSync(outputPath).length, 4);
  assert.ok(events.length >= 2);
  assert.ok(events.some((event) => event.transferredBytes === 2 && event.percent === 50));
  assert.equal(finalProgress.transferredBytes, 4);
  assert.equal(finalProgress.totalBytes, 4);
  assert.equal(finalProgress.percent, 100);
  assert.ok(finalProgress.speedBytesPerSecond > 0);
});

test("downloadUrlToFileWithResume resumes a partial runtime archive with range requests", async () => {
  const outputPath = createTempFilePath("runtime-resume.zip");
  fs.writeFileSync(outputPath, Buffer.from([1, 2]));
  const events: RuntimeDownloadProgress[] = [];
  let requestedRange = "";
  let nowMs = 0;

  const finalProgress = await downloadUrlToFileWithResume("https://example.com/runtime.zip", outputPath, {
    expectedTotalBytes: 4,
    now: () => {
      nowMs += 100;
      return nowMs;
    },
    onProgress: (event) => {
      events.push(event);
    },
    fetchImpl: async (_url, init) => {
      const headers = new Headers(init?.headers);
      requestedRange = headers.get("Range") ?? "";
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(Uint8Array.from([3]));
            controller.enqueue(Uint8Array.from([4]));
            controller.close();
          },
        }),
        {
          status: 206,
          headers: {
            "content-range": "bytes 2-3/4",
            "content-length": "2",
          },
        },
      );
    },
  });

  assert.equal(requestedRange, "bytes=2-");
  assert.deepEqual(Array.from(fs.readFileSync(outputPath)), [1, 2, 3, 4]);
  assert.ok(events.some((event) => event.transferredBytes === 2 && event.percent === 50));
  assert.ok(events.some((event) => event.transferredBytes === 3 && event.percent === 75));
  assert.equal(finalProgress.transferredBytes, 4);
  assert.equal(finalProgress.percent, 100);
});

test("downloadUrlToFileWithResume restarts from scratch when the server ignores range support", async () => {
  const outputPath = createTempFilePath("runtime-restart.zip");
  fs.writeFileSync(outputPath, Buffer.from([9, 9]));
  let requestedRange = "";

  const finalProgress = await downloadUrlToFileWithResume("https://example.com/runtime.zip", outputPath, {
    expectedTotalBytes: 4,
    fetchImpl: async (_url, init) => {
      const headers = new Headers(init?.headers);
      requestedRange = headers.get("Range") ?? "";
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(Uint8Array.from([1, 2, 3, 4]));
            controller.close();
          },
        }),
        {
          status: 200,
          headers: {
            "content-length": "4",
          },
        },
      );
    },
  });

  assert.equal(requestedRange, "bytes=2-");
  assert.deepEqual(Array.from(fs.readFileSync(outputPath)), [1, 2, 3, 4]);
  assert.equal(finalProgress.transferredBytes, 4);
  assert.equal(finalProgress.totalBytes, 4);
  assert.equal(finalProgress.percent, 100);
});

test("runWithRetry retries retryable failures with incremental backoff", async () => {
  let attempts = 0;
  const retryAttempts: number[] = [];
  const retryDelays: number[] = [];

  const result = await runWithRetry({
    operation: async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("temporary network failure");
      }
      return "ok";
    },
    retryCount: 2,
    baseDelayMs: 25,
    isRetryable: (error) => error instanceof Error && /temporary/.test(error.message),
    sleep: async (delayMs) => {
      retryDelays.push(delayMs);
    },
    onRetry: ({ attempt }) => {
      retryAttempts.push(attempt);
    },
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
  assert.deepEqual(retryAttempts, [1, 2]);
  assert.deepEqual(retryDelays, [25, 50]);
});

test("runWithRetry stops immediately on non-retryable failures", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      runWithRetry({
        operation: async () => {
          attempts += 1;
          throw new Error("sha512 mismatch");
        },
        retryCount: 3,
        isRetryable: (error) => error instanceof Error && /temporary/.test(error.message),
      }),
    /sha512 mismatch/,
  );

  assert.equal(attempts, 1);
});

test("resolveExistingPathForStatfs falls back to the nearest existing parent directory", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-runtime-statfs-"));
  const nestedTarget = path.join(tempDir, "missing", "downloads", "runtime.zip");

  const resolved = resolveExistingPathForStatfs(nestedTarget);

  assert.equal(resolved, tempDir);
});

test("resolveRuntimeTransferTimeoutMs scales up for multi-gigabyte downloads", () => {
  assert.equal(resolveRuntimeTransferTimeoutMs(0), 2 * 60 * 60_000);
  assert.ok(resolveRuntimeTransferTimeoutMs(128 * 1024 * 1024) >= 30 * 60_000);
  assert.ok(resolveRuntimeTransferTimeoutMs(5 * 1024 * 1024 * 1024) > 60 * 60_000);
});
