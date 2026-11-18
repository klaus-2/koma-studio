import type {
  ExportPackageRequest,
  ExportWorkerResponse,
  WorkerPdfPage,
  WorkerZipEntry,
} from './exportPackageWorker';

export interface ExportPoolJob {
  readonly bundleFormat: 'zip' | 'cbz' | 'cb7' | 'pdf';
  readonly scope: string;
  readonly outFormat: string;
  readonly zipEntries: readonly WorkerZipEntry[];
  readonly pdfPages?: readonly WorkerPdfPage[];
  readonly createdAt: string;
  readonly flags: ExportPackageRequest['flags'];
  // Ownership invariant: with transferBytes the pool hands every entry's buffer to the worker via
  // postMessage transfer (caller bytes detach on send); pass only freshly allocated, job-scoped
  // bytes the caller never reads again. Omitted/false keeps the copy-then-retry behavior.
  readonly transferBytes?: boolean;
}

export interface ExportPoolEvents {
  readonly onQueued?: () => void;
  readonly onWorkerStart?: (jobId: number) => void;
  readonly onWorkerDone?: (jobId: number) => void;
  readonly onRetry?: (jobId: number, message: string) => void;
}

const POOL_SIZE = 1;
const JOB_TIMEOUT_MS = 600_000;

interface PendingJob {
  readonly jobId: number;
  readonly job: ExportPoolJob;
  readonly resolve: (bytes: { blobBytes: ArrayBuffer; mimeType: string }) => void;
  readonly reject: (error: Error) => void;
  readonly attempts: { value: number };
  bytesTransferred: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

const MAX_JOB_ATTEMPTS = 2;

const buildRequest = (jobId: number, job: ExportPoolJob): ExportPackageRequest => {
  const transferBytes = job.transferBytes === true;
  const zipEntries = job.zipEntries.map((entry) => ({
    path: entry.path,
    bytes: transferBytes ? entry.bytes : entry.bytes.slice(),
  }));
  const pdfPages = job.pdfPages?.map((page) => ({
    sourceImageId: page.sourceImageId,
    bytes: transferBytes ? page.bytes : page.bytes.slice(),
    isJpeg: page.isJpeg,
  }));
  return {
    kind: 'package',
    jobId,
    bundleFormat: job.bundleFormat,
    scope: job.scope,
    outFormat: job.outFormat,
    zipEntries,
    pdfPages,
    createdAt: job.createdAt,
    flags: job.flags,
  };
};

const defaultCreateWorker = (): Worker =>
  new Worker(new URL('./exportPackageWorker.ts', import.meta.url), {
    type: 'module',
  });

export const createExportWorkerPool = (
  events: ExportPoolEvents = {},
  createWorker: () => Worker = defaultCreateWorker,
) => {
  const workers: Worker[] = [];
  const idle: Worker[] = [];
  const queue: PendingJob[] = [];
  const pending = new Map<number, PendingJob>();
  const ownerByJob = new Map<number, Worker>();
  let nextJobId = 1;
  let disposed = false;
  let lastSpawnError: Error | null = null;

  const releaseWorker = (worker: Worker): void => {
    if (!idle.includes(worker)) idle.push(worker);
    pump();
  };

  const failQueuedJobsWithoutWorkers = (cause: Error): void => {
    if (workers.length > 0 || queue.length === 0) return;
    for (const queuedJob of queue.splice(0)) {
      if (queuedJob.timer) {
        clearTimeout(queuedJob.timer);
        queuedJob.timer = null;
      }
      queuedJob.reject(
        new Error(`export worker spawn failed: ${cause.message}`),
      );
    }
  };

  const armJobTimeout = (
    jobId: number,
    rejectJob: (error: Error) => void,
  ): ReturnType<typeof setTimeout> =>
    setTimeout(() => {
      const owner = ownerByJob.get(jobId);
      if (owner) {
        terminate(owner);
        spawn();
      }
      const tracked = pending.get(jobId);
      if (tracked) {
        events.onWorkerDone?.(jobId);
        tracked.reject(
          new Error(
            `export worker job ${jobId} timed out after ${JOB_TIMEOUT_MS}ms`,
          ),
        );
        pending.delete(jobId);
        ownerByJob.delete(jobId);
        pump();
        if (workers.length === 0 && lastSpawnError) {
          failQueuedJobsWithoutWorkers(lastSpawnError);
        }
        return;
      }
      const queuedIndex = queue.findIndex((entry) => entry.jobId === jobId);
      if (queuedIndex >= 0) {
        queue.splice(queuedIndex, 1);
        rejectJob(
          new Error(
            `export worker job ${jobId} timed out queued after ${JOB_TIMEOUT_MS}ms`,
          ),
        );
      }
    }, JOB_TIMEOUT_MS);

  const settleJob = (
    job: PendingJob,
    outcome: { ok: boolean; blobBytes?: ArrayBuffer; mimeType?: string; message?: string },
  ): void => {
    if (job.timer) {
      clearTimeout(job.timer);
      job.timer = null;
    }
    pending.delete(job.jobId);
    ownerByJob.delete(job.jobId);
    events.onWorkerDone?.(job.jobId);
    if (outcome.ok) {
      job.resolve({
        blobBytes: outcome.blobBytes as ArrayBuffer,
        mimeType: outcome.mimeType as string,
      });
    } else {
      job.reject(new Error(outcome.message ?? 'export packaging failed'));
    }
  };

  const emit = (
    worker: Worker,
    response: ExportWorkerResponse,
  ): void => {
    const job = pending.get(response.jobId);
    releaseWorker(worker);
    if (!job) return;
    if (response.kind === 'package-success') {
      settleJob(job, { ok: true, blobBytes: response.blobBytes, mimeType: response.mimeType });
    } else {
      settleJob(job, { ok: false, message: response.message });
    }
  };

  const terminate = (worker: Worker): void => {
    const index = workers.indexOf(worker);
    if (index >= 0) workers.splice(index, 1);
    const idleIndex = idle.indexOf(worker);
    if (idleIndex >= 0) idle.splice(idleIndex, 1);
    worker.terminate();
  };

  const handleWorkerError = (worker: Worker, message: string): void => {
    const owned = [...pending.values()].find(
      (job) => ownerByJob.get(job.jobId) === worker,
    );
    terminate(worker);
    if (owned) {
      pending.delete(owned.jobId);
      ownerByJob.delete(owned.jobId);
      if (owned.timer) {
        clearTimeout(owned.timer);
        owned.timer = null;
      }
      owned.attempts.value += 1;
      if (owned.bytesTransferred) {
        events.onWorkerDone?.(owned.jobId);
        owned.reject(
          new Error(
            `export worker failed after transfer; retry unavailable: ${message}`,
          ),
        );
      } else if (owned.attempts.value < MAX_JOB_ATTEMPTS) {
        events.onRetry?.(owned.jobId, message);
        owned.timer = armJobTimeout(owned.jobId, owned.reject);
        enqueue(owned);
      } else {
        events.onWorkerDone?.(owned.jobId);
        owned.reject(new Error(`export worker failed twice: ${message}`));
      }
    }
    spawn();
    pump();
    if (workers.length === 0 && lastSpawnError) {
      failQueuedJobsWithoutWorkers(lastSpawnError);
    }
  };

  const spawn = (): void => {
    if (disposed || workers.length >= POOL_SIZE) return;
    let worker: Worker;
    try {
      worker = createWorker();
      lastSpawnError = null;
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error(String(error));
      lastSpawnError = normalized;
      console.error('[export-worker-pool] failed to spawn worker', normalized);
      return;
    }
    workers.push(worker);
    worker.onmessage = (event: MessageEvent<ExportWorkerResponse>) =>
      emit(worker, event.data);
    worker.onerror = (event) =>
      handleWorkerError(worker, event.message || 'worker error');
    worker.onmessageerror = () =>
      handleWorkerError(worker, 'worker message decode error');
    idle.push(worker);
  };

  const pump = (): void => {
    while (!disposed && queue.length > 0 && idle.length > 0) {
      const worker = idle.shift();
      const job = queue.shift();
      if (!worker || !job) break;
      ownerByJob.set(job.jobId, worker);
      pending.set(job.jobId, job);
      events.onWorkerStart?.(job.jobId);
      try {
        const request = buildRequest(job.jobId, job.job);
        const transfer: ArrayBufferLike[] = [];
        for (const entry of request.zipEntries) {
          transfer.push(entry.bytes.buffer);
        }
        for (const page of request.pdfPages ?? []) {
          transfer.push(page.bytes.buffer);
        }
        worker.postMessage(request, transfer);
        if (job.job.transferBytes === true) {
          job.bytesTransferred = true;
        }
      } catch (error) {
        if (job.timer) {
          clearTimeout(job.timer);
          job.timer = null;
        }
        pending.delete(job.jobId);
        ownerByJob.delete(job.jobId);
        terminate(worker);
        spawn();
        events.onWorkerDone?.(job.jobId);
        job.reject(
          new Error(
            `export worker post failed: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
        if (workers.length === 0 && lastSpawnError) {
          failQueuedJobsWithoutWorkers(lastSpawnError);
        }
      }
    }
  };

  const enqueue = (job: PendingJob): void => {
    queue.push(job);
    events.onQueued?.();
    if (!disposed && workers.length === 0) {
      spawn();
    }
    pump();
    if (workers.length === 0 && lastSpawnError) {
      failQueuedJobsWithoutWorkers(lastSpawnError);
    }
  };

  spawn();

  return {
    package(
      job: ExportPoolJob,
    ): Promise<{ blobBytes: ArrayBuffer; mimeType: string }> {
      return new Promise((resolve, reject) => {
        if (disposed) {
          reject(new Error('export worker pool disposed'));
          return;
        }
        const jobId = nextJobId;
        nextJobId += 1;
        const pendingJob: PendingJob = {
          jobId,
          job,
          resolve,
          reject,
          attempts: { value: 0 },
          bytesTransferred: false,
          timer: armJobTimeout(jobId, reject),
        };
        enqueue(pendingJob);
      });
    },
    get size(): number {
      return workers.length;
    },
    pendingCount(): number {
      return pending.size + queue.length;
    },
    dispose(): void {
      disposed = true;
      for (const job of pending.values()) {
        if (job.timer) clearTimeout(job.timer);
        job.reject(new Error('export worker pool disposed'));
      }
      pending.clear();
      ownerByJob.clear();
      for (const job of queue.splice(0)) {
        if (job.timer) clearTimeout(job.timer);
        job.reject(new Error('export worker pool disposed'));
      }
      for (const worker of workers.slice()) {
        worker.terminate();
      }
      workers.length = 0;
      idle.length = 0;
    },
  };
};

export type ExportWorkerPool = ReturnType<typeof createExportWorkerPool>;
