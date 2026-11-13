import { describe, expect, it } from 'vitest';

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
