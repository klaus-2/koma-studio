import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  attachWorkerScopeForTest,
  type ExportEncodeRequest,
  type ExportEncodeWorkerResponse,
} from './exportEncodeWorker';
import {
  createExportEncodeWorkerPool,
  createExportWorkerPool,
  resolveExportPoolSize,
} from './exportWorkerPool';
import type { ExportPoolJob } from './exportWorkerPool';

describe('resolveExportPoolSize (Fase C C6)', () => {
  it('clamps hardwareConcurrency - 1 into 2..4', () => {
    expect(resolveExportPoolSize(1)).toBe(2);
    expect(resolveExportPoolSize(2)).toBe(2);
    expect(resolveExportPoolSize(3)).toBe(2);
    expect(resolveExportPoolSize(4)).toBe(3);
    expect(resolveExportPoolSize(5)).toBe(4);
    expect(resolveExportPoolSize(8)).toBe(4);
    expect(resolveExportPoolSize(16)).toBe(4);
  });

  it('falls back to the minimum for missing or invalid values', () => {
    expect(resolveExportPoolSize(undefined)).toBe(2);
    expect(resolveExportPoolSize(Number.NaN)).toBe(2);
    expect(resolveExportPoolSize(0)).toBe(2);
    expect(resolveExportPoolSize(-4)).toBe(2);
  });
});

const makePackageJob = (): ExportPoolJob => ({
  bundleFormat: 'zip',
  scope: 'aio',
  outFormat: 'image/png',
  zipEntries: [{ path: 'images/001.png', bytes: new Uint8Array(8).fill(1) }],
  createdAt: '2026-11-22T00:00:00.000Z',
  flags: {
    includeRawText: false,
    includeTranslatedText: false,
    includeInpaintedImage: false,
    includesTypographerSession: false,
  },
});

const makeEncodeSpec = (): {
  pixels: ArrayBuffer;
  width: number;
  height: number;
  mimeType: 'image/png';
  quality: number;
} => ({
  pixels: new Uint8Array([9, 8, 7, 6]).buffer,
  width: 1,
  height: 1,
  mimeType: 'image/png',
  quality: 1,
});

class FakeEncodeWorker {
  static instances: FakeEncodeWorker[] = [];
  onmessage: ((event: MessageEvent<ExportEncodeWorkerResponse>) => void) | null =
    null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  readonly posted: {
    request: ExportEncodeRequest;
    transfer: Transferable[];
  }[] = [];

  constructor() {
    FakeEncodeWorker.instances.push(this);
  }

  postMessage(request: ExportEncodeRequest, transfer: Transferable[]): void {
    this.posted.push({ request, transfer });
  }

  terminate(): void {
    this.terminated = true;
  }

  succeedWithPng(): void {
    const last = this.posted[this.posted.length - 1];
    if (!last || !this.onmessage) return;
    this.onmessage(
      new MessageEvent('message', {
        data: {
          kind: 'encode-success',
          jobId: last.request.jobId,
          blobBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
          mimeType: last.request.mimeType,
        },
      }),
    );
  }

  failWith(message: string): void {
    const last = this.posted[this.posted.length - 1];
    if (!last || !this.onmessage) return;
    this.onmessage(
      new MessageEvent('message', {
        data: {
          kind: 'encode-failure',
          jobId: last.request.jobId,
          message,
        },
      }),
    );
  }

  crash(): void {
    this.onerror?.(new ErrorEvent('error', { message: 'encode crash' }));
  }
}

const makeEncodeWorkerFactory = (): (() => Worker) => {
  FakeEncodeWorker.instances = [];
  return () => new FakeEncodeWorker() as unknown as Worker;
};

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const stubHardwareConcurrency = (value: number): void => {
  Object.defineProperty(window.navigator, 'hardwareConcurrency', {
    value,
    configurable: true,
  });
};

const originalConcurrencyDescriptor = Object.getOwnPropertyDescriptor(
  window.navigator,
  'hardwareConcurrency',
);

afterEach(() => {
  if (originalConcurrencyDescriptor) {
    Object.defineProperty(
      window.navigator,
      'hardwareConcurrency',
      originalConcurrencyDescriptor,
    );
  }
});

describe('export encode pool (Fase C C6)', () => {
  it('round-trips a page encode through the encode worker with transferred pixels', async () => {
    const factory = makeEncodeWorkerFactory();
    const pool = createExportEncodeWorkerPool({}, factory);
    const spec = makeEncodeSpec();
    const promise = pool.encode(spec);
    await flushMicrotasks();

    const posted = FakeEncodeWorker.instances[0]?.posted[0];
    expect(posted?.request.kind).toBe('encode');
    expect(posted?.request.pixels).toBe(spec.pixels);
    expect(posted?.request.width).toBe(1);
    expect(posted?.request.height).toBe(1);
    expect(posted?.request.mimeType).toBe('image/png');
    expect(posted?.request.quality).toBe(1);
    expect(posted?.transfer).toEqual([spec.pixels]);

    FakeEncodeWorker.instances[0]?.succeedWithPng();
    const result = await promise;
    expect(result.mimeType).toBe('image/png');
    expect(new Uint8Array(result.blobBytes)[0]).toBe(0x89);
    pool.dispose();
  });

  it('rejects with the worker encode failure message', async () => {
    const factory = makeEncodeWorkerFactory();
    const pool = createExportEncodeWorkerPool({}, factory);
    const pending = pool.encode(makeEncodeSpec()).catch((error: Error) => error);
    await flushMicrotasks();

    FakeEncodeWorker.instances[0]?.failWith('OffscreenCanvas blew up');
    const error = await pending;
    expect((error as Error).message).toBe('OffscreenCanvas blew up');
    pool.dispose();
  });

  it('rejects immediately after a transferred encode crashes (no retry)', async () => {
    const factory = makeEncodeWorkerFactory();
    const retried: string[] = [];
    const pool = createExportEncodeWorkerPool(
      { onRetry: (_jobId, message) => retried.push(message) },
      factory,
    );
    const pending = pool.encode(makeEncodeSpec()).catch((error: Error) => error);
    await flushMicrotasks();

    FakeEncodeWorker.instances[0]?.crash();
    const error = await pending;
    expect((error as Error).message).toBe(
      'export worker failed after transfer; retry unavailable: encode crash',
    );
    expect(retried).toEqual([]);
    expect(FakeEncodeWorker.instances[0]?.posted).toHaveLength(1);
    pool.dispose();
  });

  it('spawns workers up to the hardware-sized pool for queued encode jobs', async () => {
    stubHardwareConcurrency(8);
    const factory = makeEncodeWorkerFactory();
    const started: number[] = [];
    const pool = createExportEncodeWorkerPool(
      { onWorkerStart: (jobId) => started.push(jobId) },
      factory,
    );
    const jobs = [
      pool.encode(makeEncodeSpec()),
      pool.encode(makeEncodeSpec()),
      pool.encode(makeEncodeSpec()),
      pool.encode(makeEncodeSpec()),
    ];
    await flushMicrotasks();

    expect(FakeEncodeWorker.instances).toHaveLength(4);
    expect(pool.size).toBe(4);
    expect(started).toHaveLength(4);
    for (const [index, worker] of FakeEncodeWorker.instances.entries()) {
      expect(worker.posted).toHaveLength(1);
      expect(worker.posted[0]?.request.jobId).toBe(index + 1);
      worker.succeedWithPng();
    }
    const results = await Promise.all(jobs);
    expect(results).toHaveLength(4);
    pool.dispose();
  });

  it('keeps package jobs on a serialized pool and rejects cross-mode calls', async () => {
    const factory = makeEncodeWorkerFactory();
    const packagePool = createExportWorkerPool({}, factory);
    await expect(
      packagePool.encode(makeEncodeSpec()),
    ).rejects.toThrow(/encode jobs require an encode worker pool/);
    packagePool.dispose();

    const encodePool = createExportEncodeWorkerPool({}, factory);
    await expect(encodePool.package(makePackageJob())).rejects.toThrow(
      /package jobs require a package worker pool/,
    );
    encodePool.dispose();
    expect(FakeEncodeWorker.instances.every((worker) => worker.terminated)).toBe(
      true,
    );
    expect(
      FakeEncodeWorker.instances.every((worker) => worker.posted.length === 0),
    ).toBe(true);
  });
});

describe('exportEncodeWorker body (Fase C C6)', () => {
  class FakeOffscreenCanvas {
    static lastContext: { putImageData: ReturnType<typeof vi.fn> } | null = null;
    readonly width: number;
    readonly height: number;
    private readonly context: {
      putImageData: ReturnType<typeof vi.fn>;
    } | null;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      this.context =
        FakeOffscreenCanvas.failGetContext
          ? null
          : { putImageData: vi.fn() };
      FakeOffscreenCanvas.lastContext = this.context;
    }

    static failGetContext = false;

    getContext(): { putImageData: ReturnType<typeof vi.fn> } | null {
      return this.context;
    }

    async convertToBlob(options: { type: string; quality?: number }): Promise<{
      arrayBuffer: () => Promise<ArrayBuffer>;
    }> {
      FakeOffscreenCanvas.lastConvertOptions = options;
      return {
        arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
      };
    }

    static lastConvertOptions: { type: string; quality?: number } | null = null;
  }

  const responses: ExportEncodeWorkerResponse[] = [];

  const dispatch = (
    request: Omit<ExportEncodeRequest, 'mimeType'> & { mimeType: string },
  ): void => {
    responses.length = 0;
    FakeOffscreenCanvas.lastConvertOptions = null;
    FakeOffscreenCanvas.lastContext = null;
    const scope = {
      onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
      postMessage: (response: ExportEncodeWorkerResponse): void => {
        responses.push(response);
      },
    };
    attachWorkerScopeForTest(scope);
    scope.onmessage?.(new MessageEvent('message', { data: request }));
  };

  const dispatchRaw = (data: unknown): void => {
    responses.length = 0;
    FakeOffscreenCanvas.lastConvertOptions = null;
    FakeOffscreenCanvas.lastContext = null;
    const scope = {
      onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
      postMessage: (response: ExportEncodeWorkerResponse): void => {
        responses.push(response);
      },
    };
    attachWorkerScopeForTest(scope);
    scope.onmessage?.(new MessageEvent('message', { data }));
  };

  it('encodes pixels through OffscreenCanvas and answers with encode-success', async () => {
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
    vi.stubGlobal(
      'ImageData',
      class {
        readonly data: Uint8ClampedArray;
        readonly width: number;
        readonly height: number;
        constructor(
          data: Uint8ClampedArray,
          width: number,
          height: number,
        ) {
          this.data = data;
          this.width = width;
          this.height = height;
        }
      },
    );
    try {
      dispatch({
        kind: 'encode',
        jobId: 7,
        pixels: new Uint8Array([4, 3, 2, 1]).buffer,
        width: 2,
        height: 2,
        mimeType: 'image/webp',
        quality: 0.8,
      });
      await flushMicrotasks();

      expect(responses).toHaveLength(1);
      const response = responses[0];
      expect(response?.kind).toBe('encode-success');
      if (response?.kind === 'encode-success') {
        expect(response.jobId).toBe(7);
        expect(response.mimeType).toBe('image/webp');
        expect(new Uint8Array(response.blobBytes)).toEqual(
          new Uint8Array([1, 2, 3]),
        );
      }
      expect(FakeOffscreenCanvas.lastContext?.putImageData).toHaveBeenCalled();
      expect(FakeOffscreenCanvas.lastConvertOptions).toEqual({
        type: 'image/webp',
        quality: 0.8,
      });
    } finally {
      vi.unstubAllGlobals();
      attachWorkerScopeForTest(null);
    }
  });

  it('answers encode-failure when the 2d context is unavailable or the mime is unsupported', async () => {
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
    vi.stubGlobal(
      'ImageData',
      class {
        constructor(
          data: Uint8ClampedArray,
          width: number,
          height: number,
        ) {
          void data;
          void width;
          void height;
        }
      },
    );
    try {
      FakeOffscreenCanvas.failGetContext = true;
      dispatch({
        kind: 'encode',
        jobId: 1,
        pixels: new ArrayBuffer(4),
        width: 1,
        height: 1,
        mimeType: 'image/png',
        quality: 1,
      });
      await flushMicrotasks();
      expect(responses).toHaveLength(1);
      expect(responses[0]?.kind).toBe('encode-failure');
      expect(
        responses[0]?.kind === 'encode-failure' ? responses[0].message : '',
      ).toBe('OffscreenCanvas 2d context unavailable');

      FakeOffscreenCanvas.failGetContext = false;
      dispatch({
        kind: 'encode',
        jobId: 2,
        pixels: new ArrayBuffer(4),
        width: 1,
        height: 1,
        mimeType: 'image/gif',
        quality: 1,
      });
      await flushMicrotasks();
      expect(responses).toHaveLength(1);
      expect(responses[0]?.kind).toBe('encode-failure');
      expect(
        responses[0]?.kind === 'encode-failure' ? responses[0].message : '',
      ).toBe('unsupported encode mime type: image/gif');
    } finally {
      vi.unstubAllGlobals();
      attachWorkerScopeForTest(null);
    }
  });

  it('ignores messages that are not encode requests', async () => {
    dispatchRaw({ kind: 'package', jobId: 3 });
    await flushMicrotasks();
    expect(responses).toHaveLength(0);
  });
});
