interface AioBatchWorkerInput<T> {
  readonly item: T;
  readonly index: number;
  readonly signal: AbortSignal;
}

interface RunAioBatchOptions<T, R> {
  readonly items: ReadonlyArray<T>;
  readonly concurrency: number;
  readonly controller: AbortController;
  readonly worker: (input: AioBatchWorkerInput<T>) => Promise<R>;
  readonly onProgress?: (completed: number, total: number) => void;
  /**
   * Converts a per-item worker failure into a result so the batch keeps going.
   * An aborted signal (or a throwing handler) still stops the run.
   */
  readonly onItemError?: (error: unknown, item: T, index: number) => R;
}

type ResultSlot<T> =
  | Readonly<{ status: 'pending' }>
  | Readonly<{ status: 'fulfilled'; value: T }>;

export function createAioAbortError(): DOMException {
  return new DOMException('AIO execution cancelled.', 'AbortError');
}

export function throwIfAioAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw createAioAbortError();
  }
}

export async function runAioBatch<T, R>({
  items,
  concurrency,
  controller,
  worker,
  onProgress,
  onItemError,
}: RunAioBatchOptions<T, R>): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new RangeError('AIO concurrency must be a positive safe integer.');
  }

  throwIfAioAborted(controller.signal);

  if (items.length === 0) {
    return [];
  }

  const queue = items.map((item, index) => ({ item, index }));
  const results: ResultSlot<R>[] = queue.map(() => ({
    status: 'pending',
  }));

  let nextIndex = 0;
  let completed = 0;
  const failures: unknown[] = [];

  const consume = async (): Promise<void> => {
    while (!controller.signal.aborted && failures.length === 0) {
      const queued = queue[nextIndex];
      nextIndex += 1;

      if (!queued) {
        return;
      }

      try {
        const value = await worker({
          ...queued,
          signal: controller.signal,
        });

        throwIfAioAborted(controller.signal);

        results[queued.index] = {
          status: 'fulfilled',
          value,
        };

        completed += 1;
        onProgress?.(completed, items.length);
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          failures.push(error);

          return;
        }

        if (!onItemError) {
          failures.push(error);

          controller.abort(createAioAbortError());

          return;
        }

        try {
          const value = onItemError(error, queued.item, queued.index);

          results[queued.index] = {
            status: 'fulfilled',
            value,
          };

          completed += 1;
          onProgress?.(completed, items.length);
        } catch (fallbackError: unknown) {
          failures.push(fallbackError);

          if (!controller.signal.aborted) {
            controller.abort(createAioAbortError());
          }

          return;
        }
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    consume,
  );

  await Promise.all(workers);

  if (failures.length > 0) {
    throw failures[0];
  }

  throwIfAioAborted(controller.signal);

  return results.map((result) => {
    if (result.status !== 'fulfilled') {
      throw new Error('AIO batch finished with an incomplete result.');
    }

    return result.value;
  });
}
