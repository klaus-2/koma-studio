export const DEFAULT_BATCH_THREADS = 4;
export const MAX_BATCH_THREADS = 32;
export const BATCH_THREADS_ENABLED_STORAGE_KEY =
  "koma-studio.batch-threads-enabled";
export const BATCH_THREADS_COUNT_STORAGE_KEY =
  "koma-studio.batch-threads-count";

export interface ConcurrentBatchWorkerContext<TItem> {
  readonly item: TItem;
  readonly index: number;
  readonly workerIndex: number;
  readonly total: number;
  readonly signal: AbortSignal;
}

export interface ConcurrentBatchProgressContext<TItem, TResult>
  extends ConcurrentBatchWorkerContext<TItem> {
  readonly completed: number;
  readonly result: TResult;
}

export interface ConcurrentBatchOptions<TItem, TResult> {
  readonly items: readonly TItem[];
  readonly concurrency: number;
  readonly worker: (
    context: ConcurrentBatchWorkerContext<TItem>,
  ) => Promise<TResult>;
  readonly onProgress?: (
    context: ConcurrentBatchProgressContext<TItem, TResult>,
  ) => Promise<void> | void;
  readonly signal?: AbortSignal | null;
}

export const clampBatchThreads = (value: number): number =>
  Number.isFinite(value)
    ? Math.min(MAX_BATCH_THREADS, Math.max(1, Math.floor(value)))
    : DEFAULT_BATCH_THREADS;

export const parseStoredBatchThreads = (
  value: string | null | undefined,
): number => {
  const normalized = value?.trim();
  if (!normalized || !/^[+-]?\d+$/u.test(normalized)) {
    return DEFAULT_BATCH_THREADS;
  }

  return clampBatchThreads(Number(normalized));
};

export const parseStoredBatchThreadsEnabled = (
  value: string | null | undefined,
): boolean => value?.trim().toLowerCase() !== "false";

export const normalizeBatchConcurrency = (
  enabled: boolean,
  requestedThreads: number,
  itemCount: number,
): number => {
  const count = Number.isFinite(itemCount)
    ? Math.max(0, Math.floor(itemCount))
    : 0;

  return Math.min(enabled ? clampBatchThreads(requestedThreads) : 1, count);
};

export const runConcurrentBatch = async <TItem, TResult>({
  items,
  concurrency,
  worker,
  onProgress,
  signal,
}: ConcurrentBatchOptions<TItem, TResult>): Promise<TResult[]> => {
  signal?.throwIfAborted();

  const entries = Array.from(items, (item, index) => ({ item, index }));
  if (entries.length === 0) return [];

  const controller = new AbortController();
  const results = new Map<number, Readonly<{ value: TResult }>>();
  const workerCount = normalizeBatchConcurrency(
    true,
    concurrency,
    entries.length,
  );

  let nextIndex = 0;
  let completed = 0;
  let failed = false;
  let failure: unknown;
  let progressQueue: Promise<void> = Promise.resolve();

  const fail = (reason: unknown): void => {
    if (failed) return;
    failed = true;
    failure = reason;
    controller.abort(reason);
  };

  const handleAbort = (): void => {
    fail(signal?.reason);
  };

  signal?.addEventListener("abort", handleAbort, { once: true });
  if (signal?.aborted) handleAbort();

  const reportProgress = (
    context: ConcurrentBatchProgressContext<TItem, TResult>,
  ): Promise<void> => {
    const task = progressQueue.then(async () => {
      if (!failed) await onProgress?.(context);
    });

    progressQueue = task.catch((error: unknown) => {
      fail(error);
    });

    return progressQueue;
  };

  const runWorker = async (workerIndex: number): Promise<void> => {
    while (!failed) {
      const entry = entries[nextIndex];
      if (!entry) return;
      nextIndex += 1;

      const context: ConcurrentBatchWorkerContext<TItem> = {
        ...entry,
        workerIndex,
        total: entries.length,
        signal: controller.signal,
      };

      try {
        controller.signal.throwIfAborted();
        const result = await worker(context);

        if (failed) return;
        controller.signal.throwIfAborted();

        results.set(entry.index, { value: result });
        completed += 1;

        await reportProgress({
          ...context,
          completed,
          result,
        });
      } catch (error: unknown) {
        fail(error);
      }
    }
  };

  try {
    await Promise.all(
      Array.from({ length: workerCount }, (_, index) => runWorker(index)),
    );

    await progressQueue;
    if (failed) throw failure;

    return entries.map(({ index }) => {
      const result = results.get(index);
      if (!result) {
        throw new Error("Concurrent batch completed without a result.");
      }
      return result.value;
    });
  } finally {
    signal?.removeEventListener("abort", handleAbort);
  }
};
