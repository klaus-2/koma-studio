import { describe, expect, it, vi } from "vitest";

import {
  clampBatchThreads,
  normalizeBatchConcurrency,
  parseStoredBatchThreads,
  parseStoredBatchThreadsEnabled,
  runConcurrentBatch,
} from "@/utils/concurrentBatch";

const deferred = <T>() => {
  let resolve: (value: T | PromiseLike<T>) => void = () => {
    throw new Error("Deferred promise was not initialized.");
  };

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

describe("batch configuration", () => {
  it.each([
    [NaN, 4],
    [Infinity, 4],
    [-1, 1],
    [3.9, 3],
    [100, 32],
  ])("clamps %s to %s", (input, expected) => {
    expect(clampBatchThreads(input)).toBe(expected);
  });

  it.each([
    [undefined, 4],
    [null, 4],
    ["", 4],
    ["3garbage", 4],
    [" 8 ", 8],
    ["0", 1],
    ["100", 32],
  ])("parses stored count %s", (input, expected) => {
    expect(parseStoredBatchThreads(input)).toBe(expected);
  });

  it("normalizes enabled state and item count", () => {
    expect(parseStoredBatchThreadsEnabled(" FALSE ")).toBe(false);
    expect(parseStoredBatchThreadsEnabled(undefined)).toBe(true);
    expect(normalizeBatchConcurrency(true, 8, 2)).toBe(2);
    expect(normalizeBatchConcurrency(false, 8, 2)).toBe(1);
    expect(normalizeBatchConcurrency(true, 8, 0)).toBe(0);
    expect(normalizeBatchConcurrency(true, 8, NaN)).toBe(0);
  });
});

describe("runConcurrentBatch", () => {
  it("preserves undefined items and undefined results", async () => {
    const result = await runConcurrentBatch({
      items: [undefined, 2, undefined],
      concurrency: 2,
      worker: ({ item }) => Promise.resolve(item),
    });

    expect(result).toEqual([undefined, 2, undefined]);
    expect(Object.keys(result)).toHaveLength(3);
  });

  it("returns an empty result without invoking workers", async () => {
    const worker = vi.fn(() => Promise.resolve(1));

    await expect(
      runConcurrentBatch({ items: [], concurrency: 4, worker }),
    ).resolves.toEqual([]);

    expect(worker).not.toHaveBeenCalled();
  });

  it("enforces concurrency and preserves input order", async () => {
    const gates = [deferred<number>(), deferred<number>(), deferred<number>()];
    const started: number[] = [];

    const result = runConcurrentBatch({
      items: gates,
      concurrency: 2,
      worker: ({ item, index }) => {
        started.push(index);
        return item.promise;
      },
    });

    expect(started).toEqual([0, 1]);

    gates[1]?.resolve(20);
    await vi.waitFor(() => expect(started).toEqual([0, 1, 2]));

    gates[2]?.resolve(30);
    gates[0]?.resolve(10);

    await expect(result).resolves.toEqual([10, 20, 30]);
  });

  it.each([null, undefined, "failure"])(
    "preserves rejection reason %s",
    async (reason) => {
      const worker = vi.fn(() => Promise.reject(reason));

      await expect(
        runConcurrentBatch({
          items: [1, 2, 3],
          concurrency: 1,
          worker,
        }),
      ).rejects.toBe(reason);

      expect(worker).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects a pre-aborted empty batch", async () => {
    const controller = new AbortController();
    const reason = new Error("cancelled");
    controller.abort(reason);

    await expect(
      runConcurrentBatch({
        items: [],
        concurrency: 1,
        signal: controller.signal,
        worker: () => Promise.resolve(1),
      }),
    ).rejects.toBe(reason);
  });

  it("propagates cancellation to in-flight workers", async () => {
    const controller = new AbortController();
    const gate = deferred<number>();
    let workerSignal: AbortSignal | undefined;

    const batch = runConcurrentBatch({
      items: [1, 2],
      concurrency: 1,
      signal: controller.signal,
      worker: ({ signal }) => {
        workerSignal = signal;
        return gate.promise;
      },
    });

    const reason = new Error("cancelled");
    controller.abort(reason);
    expect(workerSignal?.aborted).toBe(true);

    gate.resolve(1);
    await expect(batch).rejects.toBe(reason);
  });

  it("serializes progress callbacks", async () => {
    const gate = deferred<void>();
    const progress: number[] = [];

    const batch = runConcurrentBatch({
      items: [1, 2],
      concurrency: 2,
      worker: ({ item }) => Promise.resolve(item),
      onProgress: async ({ completed }) => {
        progress.push(completed);
        if (completed === 1) await gate.promise;
      },
    });

    await vi.waitFor(() => expect(progress).toEqual([1]));
    gate.resolve();
    await batch;

    expect(progress).toEqual([1, 2]);
  });

  it("treats progress failures as batch failures", async () => {
    const error = new Error("progress failed");

    await expect(
      runConcurrentBatch({
        items: [1, 2],
        concurrency: 1,
        worker: ({ item }) => Promise.resolve(item),
        onProgress: () => {
          throw error;
        },
      }),
    ).rejects.toBe(error);
  });
});
