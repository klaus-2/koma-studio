import { describe, expect, it, vi } from 'vitest';

import { createExportWorkerPool } from './exportWorkerPool';
import type {
  ExportPackageRequest,
  ExportWorkerResponse,
} from './exportPackageWorker';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<ExportWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  readonly posted: { request: ExportPackageRequest; transfer: Transferable[] }[] = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(request: ExportPackageRequest, transfer: Transferable[]): void {
    this.posted.push({ request, transfer });
  }

  terminate(): void {
    this.terminated = true;
  }

  succeedWithZip(): void {
    const last = this.posted[this.posted.length - 1];
    if (!last || !this.onmessage) return;
    const bytes = new Uint8Array([0x50, 0x4b, 3, 4]).buffer;
    this.onmessage(
      new MessageEvent('message', {
        data: {
          kind: 'package-success',
          jobId: last.request.jobId,
          blobBytes: bytes,
          mimeType: 'application/zip',
        },
      }),
    );
  }

  crash(): void {
    this.onerror?.(new ErrorEvent('error', { message: 'poisoned' }));
  }
}

const makeWorkerFactory = (): (() => Worker) => {
  FakeWorker.instances = [];
  return () => new FakeWorker() as unknown as Worker;
};

const zipJob = () => ({
  bundleFormat: 'zip' as const,
  scope: 'aio',
  outFormat: 'image/png',
  zipEntries: [{ path: 'images/001.png', bytes: new Uint8Array(16).fill(1) }],
  createdAt: '2026-11-12T00:00:00.000Z',
  flags: {
    includeRawText: false,
    includeTranslatedText: false,
    includeInpaintedImage: false,
    includesTypographerSession: false,
  },
});

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('exportWorkerPool (plan T8 — pool logic with fake workers)', () => {
  it('packages a job through the worker and resolves on success', async () => {
    const factory = makeWorkerFactory();
    const pool = createExportWorkerPool({}, factory);
    const promise = pool.package(zipJob());
    await flushMicrotasks();
    expect(FakeWorker.instances).toHaveLength(1);
    FakeWorker.instances[0]?.succeedWithZip();
    const result = await promise;
    expect(result.mimeType).toBe('application/zip');
    expect(new Uint8Array(result.blobBytes)[0]).toBe(0x50);
    pool.dispose();
  });

  it('emits queue/start/done events per job', async () => {
    const seen: string[] = [];
    const factory = makeWorkerFactory();
    const pool = createExportWorkerPool(
      {
        onQueued: () => seen.push('queued'),
        onWorkerStart: () => seen.push('start'),
        onWorkerDone: () => seen.push('done'),
      },
      factory,
    );
    const promise = pool.package(zipJob());
    await flushMicrotasks();
    FakeWorker.instances[0]?.succeedWithZip();
    await promise;
    expect(seen).toEqual(['queued', 'start', 'done']);
    pool.dispose();
  });

  it('serializes concurrent jobs through the pool (N=1): one worker, queue grows', async () => {
    const factory = makeWorkerFactory();
    const started: number[] = [];
    const done: number[] = [];
    const pool = createExportWorkerPool(
      {
        onWorkerStart: (jobId) => started.push(jobId),
        onWorkerDone: (jobId) => done.push(jobId),
      },
      factory,
    );
    const first = pool.package(zipJob());
    const second = pool.package(zipJob());
    await flushMicrotasks();
    expect(FakeWorker.instances).toHaveLength(1);
    expect(started).toHaveLength(1);
    FakeWorker.instances[0]?.succeedWithZip();
    await first;
    await flushMicrotasks();
    expect(started).toHaveLength(2);
    FakeWorker.instances[0]?.succeedWithZip();
    await second;
    expect(done).toHaveLength(2);
    expect(FakeWorker.instances).toHaveLength(1);
    pool.dispose();
  });

  it('retries once on a fresh worker when the worker crashes mid-job', async () => {
    const retried: string[] = [];
    const factory = makeWorkerFactory();
    const pool = createExportWorkerPool(
      { onRetry: (_jobId, message) => retried.push(message) },
      factory,
    );
    const promise = pool.package(zipJob());
    await flushMicrotasks();
    FakeWorker.instances[0]?.crash();
    await flushMicrotasks();
    expect(retried).toEqual(['poisoned']);
    expect(FakeWorker.instances).toHaveLength(2);
    expect(FakeWorker.instances[0]?.terminated).toBe(true);
    FakeWorker.instances[1]?.succeedWithZip();
    const result = await promise;
    expect(result.mimeType).toBe('application/zip');
    pool.dispose();
  });

  it('accounts pending work and rejects on dispose mid-job', async () => {
    const factory = makeWorkerFactory();
    const pool = createExportWorkerPool({}, factory);
    const pending = pool.package(zipJob()).catch((error: Error) => error);
    await flushMicrotasks();
    expect(pool.pendingCount()).toBe(1);
    pool.dispose();
    const error = await pending;
    expect((error as Error).message).toMatch(/disposed/);
  });

  it('rejects after dispose', async () => {
    const factory = makeWorkerFactory();
    const pool = createExportWorkerPool({}, factory);
    pool.dispose();
    await expect(pool.package(zipJob())).rejects.toThrow(/disposed/);
  });
});

describe('exportWorkerPool transferBytes (GATE-1 — transfer + fail-fast-after-transfer)', () => {
  it('posts original entry buffers without slicing when transferBytes is true and still resolves on success', async () => {
    const factory = makeWorkerFactory();
    const pool = createExportWorkerPool({}, factory);
    const bytes = new Uint8Array(16).fill(1);
    const promise = pool.package({
      ...zipJob(),
      zipEntries: [{ path: 'images/001.png', bytes }],
      transferBytes: true,
    });
    await flushMicrotasks();
    const posted = FakeWorker.instances[0]?.posted[0];
    expect(posted?.request.zipEntries[0]?.bytes).toBe(bytes);
    expect(posted?.transfer).toHaveLength(1);
    FakeWorker.instances[0]?.succeedWithZip();
    const result = await promise;
    expect(result.mimeType).toBe('application/zip');
    pool.dispose();
  });

  it('transfers original pdf page buffers without slicing when transferBytes is true', async () => {
    const factory = makeWorkerFactory();
    const pool = createExportWorkerPool({}, factory);
    const bytes = new Uint8Array(8).fill(2);
    const promise = pool.package({
      ...zipJob(),
      bundleFormat: 'pdf' as const,
      zipEntries: [],
      pdfPages: [{ sourceImageId: 'img-1', bytes, isJpeg: false }],
      transferBytes: true,
    });
    await flushMicrotasks();
    expect(FakeWorker.instances[0]?.posted[0]?.request.pdfPages?.[0]?.bytes).toBe(bytes);
    FakeWorker.instances[0]?.succeedWithZip();
    await promise;
    pool.dispose();
  });

  it('rejects immediately after onerror once bytes were transferred (no retry, no re-enqueue)', async () => {
    const factory = makeWorkerFactory();
    const retried: string[] = [];
    const pool = createExportWorkerPool(
      { onRetry: (_jobId, message) => retried.push(message) },
      factory,
    );
    const bytes = new Uint8Array(16).fill(1);
    const pending = pool
      .package({
        ...zipJob(),
        zipEntries: [{ path: 'images/001.png', bytes }],
        transferBytes: true,
      })
      .catch((error: Error) => error);
    await flushMicrotasks();
    FakeWorker.instances[0]?.crash();
    const error = await pending;
    expect((error as Error).message).toBe(
      'export worker failed after transfer; retry unavailable: poisoned',
    );
    expect(retried).toEqual([]);
    expect(pool.pendingCount()).toBe(0);
    expect(FakeWorker.instances[0]?.posted).toHaveLength(1);
    expect(FakeWorker.instances[1]?.posted ?? []).toHaveLength(0);
    pool.dispose();
  });

  it('rejects immediately after onmessageerror once bytes were transferred (no retry)', async () => {
    const factory = makeWorkerFactory();
    const retried: string[] = [];
    const pool = createExportWorkerPool(
      { onRetry: (_jobId, message) => retried.push(message) },
      factory,
    );
    const pending = pool
      .package({ ...zipJob(), transferBytes: true })
      .catch((error: Error) => error);
    await flushMicrotasks();
    FakeWorker.instances[0]?.onmessageerror?.();
    const error = await pending;
    expect((error as Error).message).toBe(
      'export worker failed after transfer; retry unavailable: worker message decode error',
    );
    expect(retried).toEqual([]);
    expect(FakeWorker.instances[0]?.posted).toHaveLength(1);
    pool.dispose();
  });

  it('rejects immediately on a synchronous postMessage throw and clears the job timer', async () => {
    vi.useFakeTimers();
    try {
      const factory = makeWorkerFactory();
      const pool = createExportWorkerPool({}, factory);
      const worker = FakeWorker.instances[0];
      if (!worker) throw new Error('expected the pool to spawn a worker');
      worker.postMessage = () => {
        throw new Error('post refused');
      };
      const pending = pool
        .package({ ...zipJob(), transferBytes: true })
        .catch((error: Error) => error);
      await flushMicrotasks();
      const error = await pending;
      expect((error as Error).message).toBe('export worker post failed: post refused');
      expect(vi.getTimerCount()).toBe(0);
      expect(FakeWorker.instances[0]?.posted).toHaveLength(0);
      expect(FakeWorker.instances[1]?.posted ?? []).toHaveLength(0);
      pool.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('slices caller bytes and retries on a fresh worker when transferBytes is false', async () => {
    const factory = makeWorkerFactory();
    const retried: string[] = [];
    const pool = createExportWorkerPool(
      { onRetry: (_jobId, message) => retried.push(message) },
      factory,
    );
    const bytes = new Uint8Array(16).fill(1);
    const promise = pool.package({
      ...zipJob(),
      zipEntries: [{ path: 'images/001.png', bytes }],
      transferBytes: false,
    });
    await flushMicrotasks();
    const firstPost = FakeWorker.instances[0]?.posted[0];
    expect(firstPost?.request.zipEntries[0]?.bytes).not.toBe(bytes);
    expect(firstPost?.request.zipEntries[0]?.bytes).toEqual(bytes);
    FakeWorker.instances[0]?.crash();
    await flushMicrotasks();
    expect(retried).toEqual(['poisoned']);
    expect(FakeWorker.instances).toHaveLength(2);
    expect(FakeWorker.instances[1]?.posted).toHaveLength(1);
    expect(FakeWorker.instances[1]?.posted[0]?.request.zipEntries[0]?.bytes).toEqual(bytes);
    FakeWorker.instances[1]?.succeedWithZip();
    const result = await promise;
    expect(result.mimeType).toBe('application/zip');
    pool.dispose();
  });

  it('slices caller bytes when transferBytes is omitted (copy behavior regression guard)', async () => {
    const factory = makeWorkerFactory();
    const pool = createExportWorkerPool({}, factory);
    const bytes = new Uint8Array(16).fill(1);
    const promise = pool.package({
      ...zipJob(),
      zipEntries: [{ path: 'images/001.png', bytes }],
    });
    await flushMicrotasks();
    const posted = FakeWorker.instances[0]?.posted[0];
    expect(posted?.request.zipEntries[0]?.bytes).not.toBe(bytes);
    expect(posted?.request.zipEntries[0]?.bytes).toEqual(bytes);
    FakeWorker.instances[0]?.succeedWithZip();
    await promise;
    pool.dispose();
  });

  it('rejects with the timeout error for a transferred job that never responds, with no double-settle on a late error', async () => {
    vi.useFakeTimers();
    try {
      const factory = makeWorkerFactory();
      const retried: string[] = [];
      const done: number[] = [];
      const pool = createExportWorkerPool(
        {
          onRetry: (_jobId, message) => retried.push(message),
          onWorkerDone: (jobId) => done.push(jobId),
        },
        factory,
      );
      const pending = pool
        .package({ ...zipJob(), transferBytes: true })
        .catch((error: Error) => error);
      await flushMicrotasks();
      vi.advanceTimersByTime(600_000);
      const error = await pending;
      expect((error as Error).message).toBe(
        'export worker job 1 timed out after 600000ms',
      );
      expect(done).toEqual([1]);
      expect(retried).toEqual([]);
      FakeWorker.instances[0]?.crash();
      await flushMicrotasks();
      expect(done).toEqual([1]);
      expect(retried).toEqual([]);
      pool.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects with the disposal error and clears timers for both active and queued jobs', async () => {
    vi.useFakeTimers();
    try {
      const factory = makeWorkerFactory();
      const pool = createExportWorkerPool({}, factory);
      const first = pool
        .package({ ...zipJob(), transferBytes: true })
        .catch((error: Error) => error);
      const queued = pool
        .package({ ...zipJob(), transferBytes: true })
        .catch((error: Error) => error);
      await flushMicrotasks();
      expect(pool.pendingCount()).toBe(2);
      expect(vi.getTimerCount()).toBe(2);
      pool.dispose();
      const [firstErr, queuedErr] = await Promise.all([first, queued]);
      expect((firstErr as Error).message).toMatch(/disposed/);
      expect((queuedErr as Error).message).toMatch(/disposed/);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('settles both an active job and a retried job queued behind it when their timeouts fire', async () => {
    vi.useFakeTimers();
    try {
      const factory = makeWorkerFactory();
      const pool = createExportWorkerPool({}, factory);
      const first = pool
        .package({ ...zipJob(), transferBytes: false })
        .catch((error: Error) => error);
      await flushMicrotasks();

      vi.advanceTimersByTime(100_000);
      const second = pool
        .package({ ...zipJob(), transferBytes: true })
        .catch((error: Error) => error);
      await flushMicrotasks();

      FakeWorker.instances[0]?.crash();
      await flushMicrotasks();

      expect(FakeWorker.instances).toHaveLength(2);
      expect(FakeWorker.instances[1]?.posted[0]?.request.jobId).toBe(2);

      vi.advanceTimersByTime(600_000);
      const [firstErr, secondErr] = await Promise.all([first, second]);
      expect((secondErr as Error).message).toBe(
        'export worker job 2 timed out after 600000ms',
      );
      expect((firstErr as Error).message).toMatch(/timed out/);
      expect(pool.pendingCount()).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      pool.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects queued and retried jobs cleanly when createWorker throws instead of hanging', async () => {
    vi.useFakeTimers();
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const baseFactory = makeWorkerFactory();
      let allowSpawn = true;
      const pool = createExportWorkerPool({}, () => {
        if (!allowSpawn) {
          throw new Error('bundle worker asset 404');
        }
        return baseFactory();
      });
      const retriedJob = pool
        .package({ ...zipJob(), transferBytes: false })
        .catch((error: Error) => error);
      await flushMicrotasks();

      allowSpawn = false;
      FakeWorker.instances[0]?.crash();
      await flushMicrotasks();

      const err = await retriedJob;
      expect((err as Error).message).toBe(
        'export worker spawn failed: bundle worker asset 404',
      );
      expect(pool.pendingCount()).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(errorSpy).toHaveBeenCalled();
      pool.dispose();
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('pumps the next queued job onto the replacement worker when the active job times out', async () => {
    vi.useFakeTimers();
    try {
      const factory = makeWorkerFactory();
      const pool = createExportWorkerPool({}, factory);
      const first = pool
        .package({ ...zipJob(), transferBytes: true })
        .catch((error: Error) => error);
      await flushMicrotasks();

      vi.advanceTimersByTime(100_000);
      const second = pool.package({ ...zipJob(), transferBytes: true });
      await flushMicrotasks();

      vi.advanceTimersByTime(500_000);
      const firstErr = await first;
      expect((firstErr as Error).message).toBe(
        'export worker job 1 timed out after 600000ms',
      );

      expect(FakeWorker.instances).toHaveLength(2);
      expect(FakeWorker.instances[1]?.posted[0]?.request.jobId).toBe(2);
      FakeWorker.instances[1]?.succeedWithZip();
      const secondResult = await second;
      expect(secondResult.mimeType).toBe('application/zip');
      pool.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('deduplicates shared ArrayBuffers in transfer list when transferBytes is true', async () => {
    const factory = makeWorkerFactory();
    const pool = createExportWorkerPool({}, factory);
    const sharedBuffer = new ArrayBuffer(32);
    const firstSlice = new Uint8Array(sharedBuffer, 0, 16);
    const secondSlice = new Uint8Array(sharedBuffer, 16, 16);
    const promise = pool.package({
      ...zipJob(),
      zipEntries: [
        { path: 'images/001.png', bytes: firstSlice },
        { path: 'images/002.png', bytes: secondSlice },
      ],
      transferBytes: true,
    });
    await flushMicrotasks();
    const posted = FakeWorker.instances[0]?.posted[0];
    expect(posted?.transfer).toHaveLength(1);
    expect(posted?.transfer[0]).toBe(sharedBuffer);
    FakeWorker.instances[0]?.succeedWithZip();
    await promise;
    pool.dispose();
  });
});
