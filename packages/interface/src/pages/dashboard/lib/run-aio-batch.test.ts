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
});
