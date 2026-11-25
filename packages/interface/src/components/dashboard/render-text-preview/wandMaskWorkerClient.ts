import {
  computeWandMaskBuffers,
  type WandMaskBuffers,
} from './wandMaskCompute';
import type {
  WandMaskWorkerRequest,
  WandMaskWorkerResponse,
} from './wandMaskWorker';

interface PendingJob {
  resolve: (buffers: WandMaskBuffers) => void;
  reject: (error: unknown) => void;
  cleanup: () => void;
}

let nextJobId = 1;
let sharedWorker: Worker | null | undefined;
const pendingJobs = new Map<number, PendingJob>();

const isWorkerResponse = (value: unknown): value is WandMaskWorkerResponse => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const jobId = Reflect.get(value, 'jobId');
  const ok = Reflect.get(value, 'ok');
  if (typeof jobId !== 'number' || typeof ok !== 'boolean') {
    return false;
  }
  if (!ok) {
    return typeof Reflect.get(value, 'message') === 'string';
  }
  return (
    typeof Reflect.get(value, 'width') === 'number' &&
    typeof Reflect.get(value, 'height') === 'number' &&
    Reflect.get(value, 'selected') instanceof Uint8Array &&
    Reflect.get(value, 'frameAData') instanceof Uint8ClampedArray &&
    Reflect.get(value, 'frameBData') instanceof Uint8ClampedArray
  );
};

const failAllPending = (reason: unknown): void => {
  const entries = Array.from(pendingJobs.entries());
  pendingJobs.clear();
  for (const [, job] of entries) {
    job.cleanup();
    job.reject(reason);
  }
};

const getWorker = (): Worker | null => {
  if (sharedWorker !== undefined) {
    return sharedWorker;
  }
  if (typeof Worker === 'undefined') {
    sharedWorker = null;
    return null;
  }
  try {
    const worker = new Worker(new URL('./wandMaskWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<unknown>): void => {
      if (!isWorkerResponse(event.data)) {
        return;
      }
      const pending = pendingJobs.get(event.data.jobId);
      if (pending === undefined) {
        return;
      }
      pendingJobs.delete(event.data.jobId);
      pending.cleanup();
      if (!event.data.ok) {
        pending.reject(new Error(event.data.message));
        return;
      }
      pending.resolve({
        width: event.data.width,
        height: event.data.height,
        selected: event.data.selected,
        frameAData: event.data.frameAData,
        frameBData: event.data.frameBData,
      });
    });
    worker.addEventListener('error', (): void => {
      sharedWorker = null;
      failAllPending(new Error('Wand mask worker failed.'));
    });
    sharedWorker = worker;
    return worker;
  } catch {
    sharedWorker = null;
    return null;
  }
};

export const resetWandMaskWorkerForTest = (): void => {
  if (sharedWorker !== undefined && sharedWorker !== null) {
    sharedWorker.terminate();
  }
  sharedWorker = undefined;
  failAllPending(new DOMException('Reset', 'AbortError'));
};

export const computeWandMaskBuffersOffThread = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<WandMaskBuffers> => {
  if (signal?.aborted === true) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }

  const worker = getWorker();
  if (worker === null) {
    return Promise.resolve(computeWandMaskBuffers(rgba, width, height));
  }

  return new Promise<WandMaskBuffers>((resolve, reject) => {
    const jobId = nextJobId;
    nextJobId += 1;

    const onAbort = (): void => {
      const pending = pendingJobs.get(jobId);
      if (pending !== undefined) {
        pendingJobs.delete(jobId);
        pending.cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      }
    };

    const cleanup = (): void => {
      signal?.removeEventListener('abort', onAbort);
    };

    pendingJobs.set(jobId, { resolve, reject, cleanup });
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const copy = new Uint8ClampedArray(rgba);
      const request: WandMaskWorkerRequest = {
        jobId,
        width,
        height,
        rgba: copy,
      };
      worker.postMessage(request, [copy.buffer]);
    } catch {
      pendingJobs.delete(jobId);
      cleanup();
      resolve(computeWandMaskBuffers(rgba, width, height));
    }
  });
};
