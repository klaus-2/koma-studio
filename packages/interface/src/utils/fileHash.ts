import type { HashWorkerRequest, HashWorkerResponse } from './hashWorker';

/**
 * Content hashing for pages.
 *
 * `computeFileHash` hashes through a small module-worker pool so the main
 * thread never materializes a page's bytes; when workers are unavailable or a
 * worker reports an error, the exact same digest is computed on the main
 * thread with `sha256Hex`. Both paths produce byte-identical hex, so existing
 * content-hash keys (thumbnail OPFS, duplicate detection) remain valid.
 */

/** Pool size frozen by the plan (A2): two workers drain one shared queue. */
const HASH_WORKER_POOL_SIZE = 2;

interface PendingHashJob {
  readonly file: Blob;
  readonly resolve: (hash: string) => void;
  readonly reject: (error: unknown) => void;
}

const toHex = (digest: ArrayBuffer): string => {
  let hex = '';
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
};

/** Main-thread digest — also the fallback path for every worker failure. */
export const sha256Hex = async (blob: Blob): Promise<string> => {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(digest);
};

const jobQueue: PendingHashJob[] = [];
const allWorkers: Worker[] = [];
const idleWorkers: Worker[] = [];
const inFlightByJobId = new Map<number, { job: PendingHashJob; worker: Worker }>();
let nextJobId = 0;
let poolUnsupported = false;

const failJobOverToMainThread = (job: PendingHashJob): void => {
  void sha256Hex(job.file).then(job.resolve, job.reject);
};

const pumpQueue = (): void => {
  while (jobQueue.length > 0) {
    const worker = idleWorkers.pop();
    if (worker === undefined) {
      return;
    }
    const job = jobQueue.shift();
    if (job === undefined) {
      idleWorkers.push(worker);
      return;
    }
    const id = nextJobId;
    nextJobId += 1;
    inFlightByJobId.set(id, { job, worker });
    const request: HashWorkerRequest = { id, file: job.file };
    // O 2º parâmetro de Worker.postMessage é a transfer list (não targetOrigin) —
    // canal do pool é same-origin por construção.
    worker.postMessage(request);
  }
};

const createPoolWorker = (): Worker | null => {
  if (typeof Worker === 'undefined') {
    return null;
  }
  try {
    const worker = new Worker(new URL('./hashWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener(
      'message',
      (event: MessageEvent<HashWorkerResponse>) => {
        const response: unknown = event.data;
        if (
          typeof response !== 'object' ||
          response === null ||
          !('id' in response) ||
          typeof response.id !== 'number'
        ) {
          return;
        }
        const inFlight = inFlightByJobId.get(response.id);
        if (!inFlight) {
          return;
        }
        inFlightByJobId.delete(response.id);
        idleWorkers.push(worker);
        if ('hash' in response && typeof response.hash === 'string') {
          inFlight.job.resolve(response.hash);
        } else {
          failJobOverToMainThread(inFlight.job);
        }
        pumpQueue();
      },
    );
    worker.addEventListener('error', () => {
      // The worker died: fail over exactly the jobs it held and drop it from
      // the pool so later jobs queue behind the survivors.
      for (const [id, inFlight] of inFlightByJobId) {
        if (inFlight.worker !== worker) {
          continue;
        }
        inFlightByJobId.delete(id);
        failJobOverToMainThread(inFlight.job);
      }
      const allIndex = allWorkers.indexOf(worker);
      if (allIndex !== -1) {
        allWorkers.splice(allIndex, 1);
      }
      const idleIndex = idleWorkers.indexOf(worker);
      if (idleIndex !== -1) {
        idleWorkers.splice(idleIndex, 1);
      }
      if (allWorkers.length === 0) {
        // The pool is gone: drain every queued job through the main-thread
        // fallback so promises can never hang behind dead workers (a later
        // computeFileHash would rebuild the pool, but nothing guarantees one
        // arrives).
        for (const queued of jobQueue.splice(0)) {
          failJobOverToMainThread(queued);
        }
      }
      pumpQueue();
    });
    return worker;
  } catch {
    return null;
  }
};

/**
 * (Re)builds the pool lazily and recovers from a fully dead pool. Returns
 * whether any worker exists — NOT whether one is idle (busy workers keep
 * draining the queue through pumpQueue).
 */
const ensurePool = (): boolean => {
  if (poolUnsupported) {
    return false;
  }
  if (allWorkers.length === 0) {
    for (let index = 0; index < HASH_WORKER_POOL_SIZE; index += 1) {
      const worker = createPoolWorker();
      if (worker === null) {
        break;
      }
      allWorkers.push(worker);
      idleWorkers.push(worker);
    }
    if (allWorkers.length === 0) {
      poolUnsupported = true;
    }
  }
  return allWorkers.length > 0;
};

/**
 * SHA-256 of the blob's full contents, hex-encoded. Offloads to the worker
 * pool when available; resolves through the main-thread `sha256Hex` whenever
 * the pool cannot exist or a worker fails, so the promise never dangles.
 */
export const computeFileHash = (file: Blob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const job: PendingHashJob = { file, resolve, reject };
    if (poolUnsupported) {
      failJobOverToMainThread(job);
      return;
    }
    if (!ensurePool()) {
      failJobOverToMainThread(job);
      return;
    }
    jobQueue.push(job);
    pumpQueue();
  });

/** Head/mid/tail windows are 64KB each; the size field closes the payload. */
const PARTIAL_HASH_CHUNK_SIZE = 64 * 1024;
const SIZE_FIELD_BYTES = 8;

/**
 * Deterministic partial-content fingerprint (I6 gate 2): head 64KB + mid 64KB
 * + tail 64KB + file size. Windows are clamped so no byte is ever hashed
 * twice — files below 192KB are covered exactly once end to end. Cheap by
 * design (≤192KB on the main thread) and used ONLY as a fast mismatch proof:
 * a mismatch excludes duplication without reading the files in full, a match
 * still requires the full hash to confirm.
 */
export const computePartialHashFingerprint = async (
  file: Blob,
): Promise<string> => {
  const size = file.size;
  const headEnd = Math.min(PARTIAL_HASH_CHUNK_SIZE, size);
  const tailStart = Math.max(headEnd, size - PARTIAL_HASH_CHUNK_SIZE);
  const midStart = headEnd;
  const midEnd = Math.min(midStart + PARTIAL_HASH_CHUNK_SIZE, tailStart);
  const chunks = await Promise.all([
    file.slice(0, headEnd).arrayBuffer(),
    file.slice(midStart, midEnd).arrayBuffer(),
    file.slice(tailStart, size).arrayBuffer(),
  ]);
  const payloadLength =
    chunks.reduce((total, chunk) => total + chunk.byteLength, 0) +
    SIZE_FIELD_BYTES;
  const payload = new Uint8Array(payloadLength);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  const sizeView = new DataView(
    payload.buffer,
    payloadLength - SIZE_FIELD_BYTES,
    SIZE_FIELD_BYTES,
  );
  // setBigUint64 addresses the view (which starts at the size field), so the
  // field is written at view-relative offset 0.
  sizeView.setBigUint64(0, BigInt(size), false);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return toHex(digest);
};
