import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TranslationKey } from '../../../i18n/messages';
import type { OptimizationRecipe } from '../../../types';
import { runOptimizerJob } from './optimizerJob';
import { PRESET_RECIPES } from './optimizerRecipe';

type OptimizerJobPayload = {
  sourceBuffer: ArrayBuffer;
  sourceMimeType: string;
} & OptimizationRecipe;

type OptimizerJobMessage = { id: string } & OptimizerJobPayload;

type OptimizerJobResponse = {
  id: string;
  ok: boolean;
  blob?: Blob;
  width?: number;
  height?: number;
  error?: string;
};

type OptimizerJobPost = {
  payload: OptimizerJobMessage;
  transfer: Transferable[];
};

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<OptimizerJobResponse>) => void) | null =
    null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  readonly posted: OptimizerJobPost[] = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(payload: OptimizerJobMessage, transfer: Transferable[]): void {
    this.posted.push({ payload, transfer });
  }

  terminate(): void {
    this.terminated = true;
  }

  respondWith(response: OptimizerJobResponse): void {
    this.onmessage?.(new MessageEvent('message', { data: response }));
  }

  fail(): void {
    this.onerror?.(new ErrorEvent('error', { message: 'poisoned' }));
  }
}

const t = (key: TranslationKey): string => key;

const makePayload = (): OptimizerJobPayload => ({
  sourceBuffer: new ArrayBuffer(16),
  sourceMimeType: 'image/webp',
  ...PRESET_RECIPES['web-light'],
});

const requirePostedWorker = (): FakeWorker => {
  const worker = FakeWorker.instances[0];
  if (!worker) {
    throw new Error('expected the optimizer worker to be created');
  }
  return worker;
};

const requireFirstPost = (worker: FakeWorker): OptimizerJobPost => {
  const post = worker.posted[0];
  if (!post) {
    throw new Error('expected the job to be posted to the worker');
  }
  return post;
};

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('runOptimizerJob (plan T2 — transferable source buffer)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeWorker.instances = [];
  });

  it('posts the job with the source buffer as the sole transferable', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const payload = makePayload();

    void runOptimizerJob(payload, t);
    await flushMicrotasks();

    const worker = requirePostedWorker();
    const post = requireFirstPost(worker);

    expect(worker.posted).toHaveLength(1);
    expect(post.transfer).toHaveLength(1);
    expect(post.transfer[0]).toBe(payload.sourceBuffer);
    expect(post.payload.sourceBuffer).toBe(payload.sourceBuffer);
    expect(post.payload.sourceMimeType).toBe('image/webp');
    expect(post.payload.preset).toBe('web-light');
    expect(post.payload.id).toMatch(/^optimizer-/);
  });

  it('ignores responses with a foreign id and settles on the matching id, terminating the worker', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const payload = makePayload();

    const promise = runOptimizerJob(payload, t);
    await flushMicrotasks();

    const worker = requirePostedWorker();
    const requestId = requireFirstPost(worker).payload.id;
    let settled = false;
    void promise.then(() => {
      settled = true;
    });

    worker.respondWith({
      id: `${requestId}-other`,
      ok: true,
      blob: new Blob(['late']),
      width: 10,
      height: 10,
    });
    await flushMicrotasks();

    expect(settled).toBe(false);
    expect(worker.terminated).toBe(false);

    worker.respondWith({
      id: requestId,
      ok: true,
      blob: new Blob(['ok']),
      width: 100,
      height: 200,
    });
    const result = await promise;

    expect(settled).toBe(true);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.width).toBe(100);
    expect(result.height).toBe(200);
    expect(worker.terminated).toBe(true);
  });

  it('rejects with the translated failure message and terminates on an error response', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const payload = makePayload();

    const promise = runOptimizerJob(payload, t);
    await flushMicrotasks();

    const worker = requirePostedWorker();
    const requestId = requireFirstPost(worker).payload.id;

    worker.respondWith({ id: requestId, ok: false, error: 'decode failed' });

    await expect(promise).rejects.toThrow('decode failed');
    expect(worker.terminated).toBe(true);
  });

  it('rejects with the default failure message when the error response omits the error text', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const payload = makePayload();

    const promise = runOptimizerJob(payload, t);
    await flushMicrotasks();

    const worker = requirePostedWorker();
    const requestId = requireFirstPost(worker).payload.id;

    worker.respondWith({ id: requestId, ok: false });

    await expect(promise).rejects.toThrow('optimizer.error.failed');
    expect(worker.terminated).toBe(true);
  });

  it('rejects with the worker error message and terminates when the worker errors', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const payload = makePayload();

    const promise = runOptimizerJob(payload, t);
    await flushMicrotasks();

    const worker = requirePostedWorker();
    requireFirstPost(worker);

    worker.fail();

    await expect(promise).rejects.toThrow('optimizer.error.worker');
    expect(worker.terminated).toBe(true);
  });

  it('rejects with the worker-unavailable message when Worker is undefined', async () => {
    vi.stubGlobal('Worker', undefined);
    const payload = makePayload();

    await expect(runOptimizerJob(payload, t)).rejects.toThrow(
      'optimizer.error.worker',
    );
    expect(FakeWorker.instances).toHaveLength(0);
  });
});
