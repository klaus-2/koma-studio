import { describe, expect, it, vi } from 'vitest';

import {
  createAioAbortError,
  runAioBatch,
} from '@/pages/dashboard/lib/run-aio-batch';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;

  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (value): void => {
      if (!resolvePromise) {
        throw new Error('Deferred promise was not initialized.');
      }

      resolvePromise(value);
    },
  };
}

describe('runAioBatch', () => {
  it('preserves input order when workers finish out of order', async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    const progress = vi.fn();

    const result = runAioBatch({
      items: [first, second],
      concurrency: 2,
      controller: new AbortController(),
      worker: ({ item }) => item.promise,
      onProgress: progress,
    });

    second.resolve(20);
    first.resolve(10);

    await expect(result).resolves.toEqual([10, 20]);
    expect(progress).toHaveBeenLastCalledWith(2, 2);
  });

  it('does not exceed the configured concurrency', async () => {
    const release = deferred<void>();
    let active = 0;
    let peak = 0;

    const result = runAioBatch({
      items: [1, 2, 3, 4, 5],
      concurrency: 2,
      controller: new AbortController(),
      worker: async ({ item }) => {
        active += 1;
        peak = Math.max(peak, active);

        await release.promise;

        active -= 1;
        return item;
      },
    });

    expect(peak).toBe(2);

    release.resolve(undefined);

    await expect(result).resolves.toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(2);
  });

  it('aborts siblings and drains them before rejecting', async () => {
    const release = deferred<void>();
    const siblingStarted = deferred<void>();
    const failure = new Error('Worker failed');
    const controller = new AbortController();
    let siblingFinished = false;

    const result = runAioBatch({
      items: [0, 1, 2],
      concurrency: 2,
      controller,
      worker: async ({ item }) => {
        if (item === 0) {
          await siblingStarted.promise;
          throw failure;
        }

        siblingStarted.resolve(undefined);
        await release.promise;
        siblingFinished = true;

        return item;
      },
    });

    const rejection = expect(result).rejects.toBe(failure);

    await siblingStarted.promise;
    await Promise.resolve();

    expect(controller.signal.aborted).toBe(true);
    expect(siblingFinished).toBe(false);

    release.resolve(undefined);

    await rejection;
    expect(siblingFinished).toBe(true);
  });

  it('does not start workers after prior cancellation', async () => {
    const controller = new AbortController();
    const worker = vi.fn(async (): Promise<number> => 1);

    controller.abort(createAioAbortError());

    await expect(
      runAioBatch({
        items: [1],
        concurrency: 1,
        controller,
        worker,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(worker).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid concurrency %s',
    async (concurrency) => {
      await expect(
        runAioBatch({
          items: [1],
          concurrency,
          controller: new AbortController(),
          worker: async ({ item }) => item,
        }),
      ).rejects.toBeInstanceOf(RangeError);
    },
  );

  it('handles an empty batch', async () => {
    await expect(
      runAioBatch({
        items: [],
        concurrency: 1,
        controller: new AbortController(),
        worker: async () => 1,
      }),
    ).resolves.toEqual([]);
  });

  it('treats progress callback failure as a batch failure', async () => {
    const failure = new Error('Progress failed');
    const controller = new AbortController();

    await expect(
      runAioBatch({
        items: [1],
        concurrency: 1,
        controller,
        worker: async ({ item }) => item,
        onProgress: () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);

    expect(controller.signal.aborted).toBe(true);
  });

  it('continues after an item failure when onItemError is provided', async () => {
    const controller = new AbortController();
    const progress = vi.fn();
    const failure = new Error('Item 3 failed');
    const onItemError = vi.fn(
      (error: unknown, item: number, index: number): string => {
        expect(error).toBe(failure);
        return `failed-${item}-${index}`;
      },
    );

    const results = await runAioBatch({
      items: [0, 1, 2, 3, 4],
      concurrency: 2,
      controller,
      worker: async ({ item }) => {
        if (item === 2) {
          throw failure;
        }

        return `ok-${item}`;
      },
      onItemError,
      onProgress: progress,
    });

    expect(results).toEqual(['ok-0', 'ok-1', 'failed-2-2', 'ok-3', 'ok-4']);
    expect(controller.signal.aborted).toBe(false);
    expect(onItemError).toHaveBeenCalledTimes(1);
    expect(onItemError).toHaveBeenCalledWith(failure, 2, 2);
    expect(progress).toHaveBeenCalledTimes(5);
    expect(progress).toHaveBeenLastCalledWith(5, 5);
  });

  it('does not route user cancellation through onItemError', async () => {
    const controller = new AbortController();
    const started = deferred<void>();
    const release = deferred<void>();
    const onItemError = vi.fn(() => 0);
    let calls = 0;

    const result = runAioBatch({
      items: [1, 2, 3],
      concurrency: 1,
      controller,
      worker: async ({ signal }) => {
        calls += 1;
        started.resolve(undefined);
        await release.promise;

        if (signal.aborted) {
          throw createAioAbortError();
        }

        return 1;
      },
      onItemError,
    });

    const rejection = expect(result).rejects.toMatchObject({
      name: 'AbortError',
    });

    await started.promise;
    controller.abort(createAioAbortError());
    release.resolve(undefined);

    await rejection;
    expect(onItemError).not.toHaveBeenCalled();
    expect(calls).toBe(1);
    expect(controller.signal.aborted).toBe(true);
  });

  it('aborts when the onItemError handler throws', async () => {
    const controller = new AbortController();
    const itemFailure = new Error('Worker failed');
    const handlerFailure = new Error('Handler failed');
    let calls = 0;

    await expect(
      runAioBatch({
        items: [0, 1, 2],
        concurrency: 1,
        controller,
        worker: async ({ item }) => {
          calls += 1;

          if (item === 0) {
            throw itemFailure;
          }

          return item;
        },
        onItemError: () => {
          throw handlerFailure;
        },
      }),
    ).rejects.toBe(handlerFailure);

    expect(controller.signal.aborted).toBe(true);
    expect(calls).toBe(1);
  });
});
