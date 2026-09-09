export const DEFAULT_BATCH_THREADS = 4;
export const MAX_BATCH_THREADS = 32;
export const BATCH_THREADS_ENABLED_STORAGE_KEY = "koma-studio.batch-threads-enabled";
export const BATCH_THREADS_COUNT_STORAGE_KEY = "koma-studio.batch-threads-count";

export interface ConcurrentBatchWorkerContext<TItem> {
  item: TItem;
  index: number;
  workerIndex: number;
  total: number;
}

export interface ConcurrentBatchProgressContext<TItem, TResult>
  extends ConcurrentBatchWorkerContext<TItem> {
  completed: number;
  result: TResult;
}

export interface ConcurrentBatchOptions<TItem, TResult> {
  items: TItem[];
  concurrency: number;
  worker: (context: ConcurrentBatchWorkerContext<TItem>) => Promise<TResult>;
  onProgress?: (context: ConcurrentBatchProgressContext<TItem, TResult>) => Promise<void> | void;
  signal?: AbortSignal | null;
}

export const clampBatchThreads = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_BATCH_THREADS;
  }

  const nextValue = Math.floor(value);
  return Math.min(MAX_BATCH_THREADS, Math.max(1, nextValue));
};

export const parseStoredBatchThreads = (
  value: string | null | undefined,
): number => {
  if (!value) {
    return DEFAULT_BATCH_THREADS;
  }

  return clampBatchThreads(Number.parseInt(value, 10));
};

export const parseStoredBatchThreadsEnabled = (
  value: string | null | undefined,
): boolean => value !== "false";

export const normalizeBatchConcurrency = (
  enabled: boolean,
  requestedThreads: number,
  itemCount: number,
): number => {
  const requested = enabled ? clampBatchThreads(requestedThreads) : 1;
  const safeItemCount = Math.max(1, itemCount);
  return Math.min(requested, safeItemCount);
};

export const runConcurrentBatch = async <TItem, TResult>({
  items,
  concurrency,
  worker,
  onProgress,
  signal,
}: ConcurrentBatchOptions<TItem, TResult>): Promise<TResult[]> => {
  if (items.length === 0) {
    return [];
  }

  const normalizedConcurrency = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length));
  const results = Array.from<TResult>({ length: items.length });
  let nextIndex = 0;
  let completed = 0;
  let firstError: unknown = null;

  const claimNextIndex = (): number | null => {
    if (firstError !== null) {
      return null;
    }

    if (signal?.aborted) {
      firstError ??=
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException("The operation was aborted.", "AbortError");
      return null;
    }

    if (nextIndex >= items.length) {
      return null;
    }

    const currentIndex = nextIndex;
    nextIndex += 1;
    return currentIndex;
  };

  const runWorker = async (workerIndex: number): Promise<void> => {
    while (true) {
      const currentIndex = claimNextIndex();
      if (currentIndex === null) {
        return;
      }

      const item = items[currentIndex];
      if (item === undefined) {
        return;
      }

      try {
        if (signal?.aborted) {
          throw (
            signal.reason instanceof Error
              ? signal.reason
              : new DOMException("The operation was aborted.", "AbortError")
          );
        }

        const result = await worker({
          item,
          index: currentIndex,
          workerIndex,
          total: items.length,
        });

        results[currentIndex] = result;
        completed += 1;

        await onProgress?.({
          item,
          index: currentIndex,
          workerIndex,
          total: items.length,
          completed,
          result,
        });
      } catch (error) {
        firstError ??= error;
        return;
      }
    }
  };

  await Promise.all(
    Array.from({ length: normalizedConcurrency }, (_, workerIndex) =>
      runWorker(workerIndex),
    ),
  );

  if (firstError !== null) {
    throw firstError;
  }

  return results;
};
