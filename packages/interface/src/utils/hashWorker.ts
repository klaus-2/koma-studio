/**
 * SHA-256 page hashing worker (module worker).
 *
 * Receives `{ id, file: Blob }` and answers `{ id, hash }` on success or
 * `{ id, error }` on failure. The file's bytes are materialized INSIDE this
 * worker (`file.arrayBuffer()` + `crypto.subtle.digest`): the main thread
 * never reads the bytes and peak memory stays at one page per in-flight job.
 * Self-contained on purpose: the worker must not pull the pool module that
 * constructs it.
 */

export interface HashWorkerRequest {
  id: number;
  file: Blob;
}

interface HashWorkerSuccess {
  id: number;
  hash: string;
}

interface HashWorkerFailure {
  id: number;
  error: string;
}

export type HashWorkerResponse = HashWorkerSuccess | HashWorkerFailure;

const toHex = (digest: ArrayBuffer): string => {
  let hex = '';
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
};

/**
 * The core the worker executes. Exported so the parity suite can run this
 * exact code path on the main thread and pin it against `sha256Hex`.
 */
export const hashBlobToHex = async (file: Blob): Promise<string> => {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(digest);
};

self.onmessage = async (event: MessageEvent<HashWorkerRequest>) => {
  const { id, file } = event.data;
  try {
    const success: HashWorkerSuccess = { id, hash: await hashBlobToHex(file) };
    // DedicatedWorkerGlobalScope.postMessage receives a transfer list, not a
    // targetOrigin: a string throws without ever reaching the pool.
    self.postMessage(success);
  } catch (error: unknown) {
    const failure: HashWorkerFailure = {
      id,
      error: error instanceof Error
        ? error.message
        : 'Hashing failed inside the worker.',
    };
    self.postMessage(failure);
  }
};
