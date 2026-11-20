import { afterEach, describe, expect, it, vi } from 'vitest';

import { hashBlobToHex } from './hashWorker';

const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const PARTIAL_CHUNK = 64 * 1024;

type MockBehavior = 'success' | 'error-response' | 'crash' | 'deferred';

interface QueuedMockMessage {
  worker: MockHashWorker;
  id: number;
  file: Blob;
}

const encoder = new TextEncoder();
const blobOf = (text: string): Blob => new Blob([encoder.encode(text)]);

/** The pool lives in module state: every test loads a fresh instance. */
const loadFileHash = async (): Promise<typeof import('./fileHash')> => {
  vi.resetModules();
  return await import('./fileHash');
};

let mockBehavior: MockBehavior = 'success';
let mockInstances: MockHashWorker[] = [];
let pendingResponses: QueuedMockMessage[] = [];
let postCallCount = 0;

class MockHashWorker {
  readonly listeners = new Map<string, (event: MessageEvent) => void>();

  constructor(_url: URL, _options: { type: string }) {
    mockInstances.push(this);
  }

  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void,
  ): void {
    this.listeners.set(type, listener);
  }

  postMessage(message: unknown): void {
    postCallCount += 1;
    if (typeof message !== 'object' || message === null) {
      return;
    }
    if (!('id' in message) || typeof message.id !== 'number') {
      return;
    }
    if (!('file' in message) || !(message.file instanceof Blob)) {
      return;
    }
    const id = message.id;
    const file = message.file;
    pendingResponses.push({ worker: this, id, file });
    if (mockBehavior !== 'deferred') {
      void Promise.resolve().then(() => respondToMock(this, id, file));
    }
  }

  terminate(): void {}
}

const respondToMock = async (
  worker: MockHashWorker,
  id: number,
  file: Blob,
): Promise<void> => {
  if (mockBehavior === 'crash') {
    worker.listeners.get('error')?.(new MessageEvent('error'));
    return;
  }
  const listener = worker.listeners.get('message');
  if (mockBehavior === 'error-response') {
    listener?.(
      new MessageEvent('message', { data: { id, error: 'worker hash failed.' } }),
    );
    return;
  }
  listener?.(
    new MessageEvent('message', { data: { id, hash: await hashBlobToHex(file) } }),
  );
};

const installMockWorkers = (behavior: MockBehavior): void => {
  mockBehavior = behavior;
  mockInstances = [];
  pendingResponses = [];
  postCallCount = 0;
  vi.stubGlobal('Worker', MockHashWorker);
};

/** Drains every mocked worker response (and any re-posts) until quiet. */
const flushMockWorkers = async (): Promise<void> => {
  for (;;) {
    const batch = pendingResponses.splice(0);
    if (batch.length === 0) {
      return;
    }
    for (const item of batch) {
      await respondToMock(item.worker, item.id, item.file);
    }
  }
};

const withBytes = (
  bytes: Uint8Array<ArrayBuffer>,
  changes: ReadonlyArray<readonly [number, number]>,
): Uint8Array<ArrayBuffer> => {
  const next = bytes.slice();
  for (const [index, value] of changes) {
    next[index] = value;
  }
  return next;
};

const repeatedBytes = (value: number, length: number): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(length);
  bytes.fill(value);
  return bytes;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('computeFileHash', () => {
  it('produces the NIST SHA-256 vector for "abc" (hex encoding pinned)', async () => {
    const { sha256Hex } = await loadFileHash();
    expect(await sha256Hex(blobOf('abc'))).toBe(SHA256_ABC);
  });

  it('matches sha256Hex on the main thread when workers are unavailable', async () => {
    const { computeFileHash, sha256Hex } = await loadFileHash();
    const blob = blobOf('main-thread fallback bytes');
    expect(await computeFileHash(blob)).toBe(await sha256Hex(blob));
    expect(await computeFileHash(blobOf('abc'))).toBe(SHA256_ABC);
  });

  it('runs the worker core (arrayBuffer + digest) to the same hex as sha256Hex', async () => {
    const { sha256Hex } = await loadFileHash();
    const blob = blobOf('worker core parity bytes');
    expect(await hashBlobToHex(blob)).toBe(await sha256Hex(blob));
    expect(await hashBlobToHex(blobOf('abc'))).toBe(SHA256_ABC);
  });

  it('resolves through the worker response when the pool is available', async () => {
    installMockWorkers('success');
    const { computeFileHash, sha256Hex } = await loadFileHash();
    const blob = blobOf('worker success bytes');
    expect(await computeFileHash(blob)).toBe(await sha256Hex(blob));
    expect(postCallCount).toBe(1);
  });

  it('falls back to the main thread when the worker answers an error', async () => {
    installMockWorkers('error-response');
    const { computeFileHash, sha256Hex } = await loadFileHash();
    const blob = blobOf('worker error fallback bytes');
    expect(await computeFileHash(blob)).toBe(await sha256Hex(blob));
    expect(postCallCount).toBe(1);
  });

  it('falls back when constructing the worker throws', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('Worker unavailable.');
        }
      },
    );
    const { computeFileHash, sha256Hex } = await loadFileHash();
    const blob = blobOf('construction fallback bytes');
    expect(await computeFileHash(blob)).toBe(await sha256Hex(blob));
  });

  it('fails over to the main thread when the worker crashes', async () => {
    installMockWorkers('crash');
    const { computeFileHash, sha256Hex } = await loadFileHash();
    const blob = blobOf('worker crash fallback bytes');
    expect(await computeFileHash(blob)).toBe(await sha256Hex(blob));
    expect(postCallCount).toBe(1);
  });

  it('queues jobs beyond the pool of two and drains them in order', async () => {
    installMockWorkers('deferred');
    const { computeFileHash, sha256Hex } = await loadFileHash();
    const blobs = [blobOf('first'), blobOf('second'), blobOf('third')];
    const pending = blobs.map((blob) => computeFileHash(blob));

    // Pool of 2: the third job stays queued until a worker is released.
    expect(postCallCount).toBe(2);

    await flushMockWorkers();
    expect(postCallCount).toBe(3);

    const hashes = await Promise.all(pending);
    const expected = await Promise.all(blobs.map((blob) => sha256Hex(blob)));
    expect(hashes).toEqual(expected);
  });
});

describe('computePartialHashFingerprint', () => {
  it('is deterministic for identical content', async () => {
    const { computePartialHashFingerprint } = await loadFileHash();
    const blob = blobOf('deterministic fingerprint bytes');
    expect(await computePartialHashFingerprint(blob)).toBe(
      await computePartialHashFingerprint(blobOf('deterministic fingerprint bytes')),
    );
  });

  it('distinguishes different content of the same size', async () => {
    const { computePartialHashFingerprint } = await loadFileHash();
    expect(await computePartialHashFingerprint(blobOf('content-a'))).not.toBe(
      await computePartialHashFingerprint(blobOf('content-b')),
    );
  });

  it('covers small files end to end (clamped windows, no double overlap)', async () => {
    const { computePartialHashFingerprint } = await loadFileHash();
    const base = new Blob([repeatedBytes(7, 100)]);
    const headChanged = new Blob([withBytes(repeatedBytes(7, 100), [[0, 8]])]);
    const tailChanged = new Blob([
      withBytes(repeatedBytes(7, 100), [[99, 8]]),
    ]);
    const baseFingerprint = await computePartialHashFingerprint(base);
    expect(await computePartialHashFingerprint(headChanged)).not.toBe(
      baseFingerprint,
    );
    expect(await computePartialHashFingerprint(tailChanged)).not.toBe(
      baseFingerprint,
    );
  });

  it('senses the head, mid and tail windows of large files', async () => {
    const { computePartialHashFingerprint } = await loadFileHash();
    const baseBytes = repeatedBytes(1, 200 * 1024);
    const base = new Blob([baseBytes]);
    const baseFingerprint = await computePartialHashFingerprint(base);
    // Windows: head [0, 64K), mid [64K, 128K), tail [192K-64K ... size).
    const headChanged = new Blob([withBytes(baseBytes, [[10, 9]])]);
    const midChanged = new Blob([
      withBytes(baseBytes, [[PARTIAL_CHUNK + 10, 9]]),
    ]);
    const tailChanged = new Blob([
      withBytes(baseBytes, [[200 * 1024 - 10, 9]]),
    ]);
    expect(await computePartialHashFingerprint(headChanged)).not.toBe(baseFingerprint);
    expect(await computePartialHashFingerprint(midChanged)).not.toBe(baseFingerprint);
    expect(await computePartialHashFingerprint(tailChanged)).not.toBe(baseFingerprint);
  });

  it('ignores the uncovered gap between the mid and tail windows', async () => {
    const { computePartialHashFingerprint } = await loadFileHash();
    const baseBytes = repeatedBytes(1, 200 * 1024);
    // Gap for a 200KB file: [128K, 200K - 64K) — outside every window.
    const gapChanged = new Blob([
      withBytes(baseBytes, [[128 * 1024 + 10, 9]]),
    ]);
    expect(await computePartialHashFingerprint(gapChanged)).toBe(
      await computePartialHashFingerprint(new Blob([baseBytes])),
    );
  });

  it('senses the file size when identical windows would collide', async () => {
    const { computePartialHashFingerprint } = await loadFileHash();
    // Same repeating byte everywhere: all windows match; only the size field
    // tells the two files apart (200KB vs 300KB).
    const smaller = new Blob([repeatedBytes(0xab, 200 * 1024)]);
    const larger = new Blob([repeatedBytes(0xab, 300 * 1024)]);
    expect(await computePartialHashFingerprint(smaller)).not.toBe(
      await computePartialHashFingerprint(larger),
    );
  });
});
