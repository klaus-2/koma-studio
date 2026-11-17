import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';

import type { WorkspaceDocumentV1, WorkspacePackagePayload } from "../../../../packages/types/src/workspace";
import type { ImageFilters, LoadedImage } from '../types/dashboard.types';
import { createArchivePageFile, createDirectPageFile } from '../utils/page-source';
import { openArchiveChapter } from '../utils/archive-chapter-reader';
import { buildWorkspaceCaptureState } from '../pages/dashboard/hooks/workspace-persistence.registry';
import { useImageCollectionStore } from '../pages/dashboard/stores/image-collection-store';
import type { DashboardWorkspaceCaptureState } from './dashboardWorkspace';
import { captureWorkspaceDocument } from './dashboardWorkspace.serialization';
import {
  buildWorkspaceAutosaveSignature,
  buildWorkspaceHistorySignature,
} from './dashboardWorkspace.signature';
import {
  resetWorkspaceSerializerForTests,
  runWorkspaceSerialization,
  setWorkspaceSerializerWorkerFactory,
  toWireCaptureState,
  type WorkspaceSerializeRequest,
  type WorkspaceSerializeResponse,
} from './workspaceSerializerJob';
import { attachWorkerScopeForTest } from './workspaceSerializerWorker';

const PNG_BYTES = [137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4];

const makeFilters = (): ImageFilters => ({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpen: 0,
  levels: { black: 0, white: 255, gamma: 1 },
  grayscale: false,
  inverted: false,
});

const makeDirectImage = (id: string): LoadedImage => ({
  id,
  file: createDirectPageFile(
    new File([new Uint8Array(PNG_BYTES)], `${id}.png`, {
      type: 'image/png',
      lastModified: 1_700_000_000_000,
    }),
  ),
  url: `blob:${id}`,
  width: 8,
  height: 8,
  rotation: 0,
  filters: makeFilters(),
});

const makeArchiveImage = async (id: string): Promise<LoadedImage> => {
  const zipBytes = zipSync({ 'page-000.png': new Uint8Array(PNG_BYTES) }, { level: 0 });
  const archiveFile = new File([zipBytes], `${id}.zip`, { type: 'application/zip' });
  const { chapter } = await openArchiveChapter(archiveFile);
  const entry = chapter.entries[0];
  if (!entry) {
    throw new Error('fixture archive has no image entries');
  }
  return {
    id,
    file: createArchivePageFile(chapter, entry, 'page-000.png', 'image/png'),
    url: '',
    width: 8,
    height: 8,
    rotation: 0,
    filters: makeFilters(),
  };
};

const clearImageStore = (): void => {
  useImageCollectionStore.setState({ images: [], activeId: null });
};

const seedStateWithDirectPage = (): DashboardWorkspaceCaptureState => {
  const image = makeDirectImage('serialize-direct-1');
  useImageCollectionStore.getState().addImages([image]);
  useImageCollectionStore.getState().setActiveId(image.id);
  return buildWorkspaceCaptureState(null);
};

const seedStateWithDirectAndArchivePages = async (): Promise<DashboardWorkspaceCaptureState> => {
  const direct = makeDirectImage('serialize-direct-1');
  const archive = await makeArchiveImage('serialize-archive-1');
  useImageCollectionStore.getState().addImages([direct, archive]);
  useImageCollectionStore.getState().setActiveId(direct.id);
  return buildWorkspaceCaptureState(null);
};

class FakeSerializerWorker {
  static instances: FakeSerializerWorker[] = [];
  onmessage: ((event: MessageEvent<WorkspaceSerializeResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  readonly posted: WorkspaceSerializeRequest[] = [];

  constructor() {
    FakeSerializerWorker.instances.push(this);
  }

  postMessage(message: WorkspaceSerializeRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  respondWith(response: WorkspaceSerializeResponse): void {
    this.onmessage?.(new MessageEvent('message', { data: response }));
  }

  crash(): void {
    this.onerror?.(new ErrorEvent('error', { message: 'poisoned' }));
  }
}

const trackFakeWorkers = (): FakeSerializerWorker[] => {
  const created: FakeSerializerWorker[] = [];
  setWorkspaceSerializerWorkerFactory(() => {
    const worker = new FakeSerializerWorker();
    created.push(worker);
    return worker;
  });
  return created;
};

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const toComparablePayload = (payload: WorkspacePackagePayload): {
  document: WorkspaceDocumentV1;
  manifestAssets: WorkspacePackagePayload['manifest']['assets'];
  assetBytes: { path: string; bytes: Uint8Array }[];
} => ({
  document: { ...payload.manifest.document, savedAt: '' },
  manifestAssets: payload.manifest.assets,
  assetBytes: payload.assets.map((asset) => ({
    path: asset.path,
    bytes: new Uint8Array(asset.buffer),
  })),
});

interface CapturedResponse {
  readonly response: WorkspaceSerializeResponse;
  readonly transfer?: Transferable[];
}

const driveWorkerEntry = async (
  state: DashboardWorkspaceCaptureState,
): Promise<CapturedResponse[]> => {
  const captured: CapturedResponse[] = [];
  const scope = {
    onmessage: null as ((event: MessageEvent<WorkspaceSerializeRequest>) => void) | null,
    postMessage: (response: WorkspaceSerializeResponse, transfer?: Transferable[]): void => {
      captured.push({ response, transfer });
    },
  };
  attachWorkerScopeForTest(scope);
  if (!scope.onmessage) {
    throw new Error('worker did not register onmessage');
  }
  const request: WorkspaceSerializeRequest = {
    kind: 'serialize',
    id: 'entry-request-1',
    state: toWireCaptureState(state),
  };
  scope.onmessage(new MessageEvent('message', { data: request }));
  for (let waited = 0; captured.length === 0 && waited < 5000; waited += 100) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return captured;
};

describe('workspaceSerializerJob (bridge with fake worker)', () => {
  beforeEach(() => {
    FakeSerializerWorker.instances = [];
    resetWorkspaceSerializerForTests();
  });

  afterEach(() => {
    resetWorkspaceSerializerForTests();
    clearImageStore();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('posts the serialized state, resolves the payload and signatures on success', async () => {
    const state = seedStateWithDirectPage();
    const created = trackFakeWorkers();
    const reference = await captureWorkspaceDocument(state);
    const promise = runWorkspaceSerialization(state);
    await flushMicrotasks();

    expect(created).toHaveLength(1);
    const request = created[0]?.posted[0];
    expect(request?.kind).toBe('serialize');
    const wireFile = request?.state.images[0]?.file;
    expect(wireFile?.kind).toBe('direct');
    if (wireFile?.kind === 'direct') {
      expect(wireFile.resident).toBeInstanceOf(File);
    }
    if (!request) throw new Error('worker received no request');

    created[0]?.respondWith({
      kind: 'serialize-success',
      id: request.id,
      payload: reference,
      autosaveSignature: 'worker-autosave-signature',
      historySignature: 'worker-history-signature',
    });
    const result = await promise;
    expect(result.payload).toBe(reference);
    expect(result.autosaveSignature).toBe('worker-autosave-signature');
    expect(result.historySignature).toBe('worker-history-signature');
  });

  it('falls back to the main-thread sequence on timeout with identical signatures and payload', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('fixture-uuid');
    const state = seedStateWithDirectPage();
    const created = trackFakeWorkers();
    const reference = await captureWorkspaceDocument(state);
    const referenceAutosave = buildWorkspaceAutosaveSignature(state);
    const referenceHistory = buildWorkspaceHistorySignature(state);

    const promise = runWorkspaceSerialization(state);
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await promise;

    expect(created).toHaveLength(1);
    expect(created[0]?.terminated).toBe(true);
    expect(result.autosaveSignature).toBe(referenceAutosave);
    expect(result.historySignature).toBe(referenceHistory);
    expect(toComparablePayload(result.payload)).toEqual(toComparablePayload(reference));
  });

  it('terminates on worker error, retries once on a rebuilt worker, then permanently degrades', async () => {
    const state = seedStateWithDirectPage();
    const referenceAutosave = buildWorkspaceAutosaveSignature(state);
    const referenceHistory = buildWorkspaceHistorySignature(state);
    const created = trackFakeWorkers();

    const promise = runWorkspaceSerialization(state);
    await flushMicrotasks();
    expect(created).toHaveLength(1);
    created[0]?.crash();
    await flushMicrotasks();
    expect(created[0]?.terminated).toBe(true);
    expect(created).toHaveLength(2);
    expect(created[1]?.posted).toHaveLength(1);

    created[1]?.crash();
    const result = await promise;
    expect(result.autosaveSignature).toBe(referenceAutosave);
    expect(result.historySignature).toBe(referenceHistory);

    const degradedResult = await runWorkspaceSerialization(state);
    expect(created).toHaveLength(2);
    expect(degradedResult.autosaveSignature).toBe(referenceAutosave);
    expect(degradedResult.historySignature).toBe(referenceHistory);
  });

  it('ignores a response with a stale id and settles on the correlated response', async () => {
    const state = seedStateWithDirectPage();
    trackFakeWorkers();
    const promise = runWorkspaceSerialization(state);
    await flushMicrotasks();
    const worker = FakeSerializerWorker.instances[0];
    if (!worker) throw new Error('no fake worker was created');

    worker.respondWith({
      kind: 'serialize-error',
      id: 'workspace-serialize-999',
      message: 'stale response',
    });
    const request = worker.posted[0];
    if (!request) throw new Error('worker received no request');

    worker.respondWith({
      kind: 'serialize-success',
      id: request.id,
      payload: await captureWorkspaceDocument(state),
      autosaveSignature: 'correlated-autosave-signature',
      historySignature: 'correlated-history-signature',
    });
    const result = await promise;
    expect(result.autosaveSignature).toBe('correlated-autosave-signature');
    expect(result.historySignature).toBe('correlated-history-signature');
  });

  it('warns with the job id and falls back when the worker reports a serialization error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = seedStateWithDirectPage();
    trackFakeWorkers();
    const promise = runWorkspaceSerialization(state);
    await flushMicrotasks();
    const worker = FakeSerializerWorker.instances[0];
    if (!worker) throw new Error('no fake worker was created');
    const request = worker.posted[0];
    if (!request) throw new Error('worker received no request');

    worker.respondWith({
      kind: 'serialize-error',
      id: request.id,
      message: 'worker serialization failed',
    });
    const result = await promise;

    expect(result.autosaveSignature).toBe(buildWorkspaceAutosaveSignature(state));
    expect(result.historySignature).toBe(buildWorkspaceHistorySignature(state));
    expect(warnSpy).toHaveBeenCalledWith(
      '[workspace-serializer] worker serialization failed; falling back.',
      { jobId: request.id, message: 'worker serialization failed' },
    );
  });

  it('resets the failure count after a successful round-trip, so spaced failures do not degrade', async () => {
    const state = seedStateWithDirectPage();
    const created = trackFakeWorkers();

    const first = runWorkspaceSerialization(state);
    await flushMicrotasks();
    expect(created).toHaveLength(1);
    created[0]?.crash();
    await flushMicrotasks();
    expect(created).toHaveLength(2);
    const retryRequest = created[1]?.posted[0];
    if (!retryRequest) throw new Error('rebuilt worker received no request');
    created[1]?.respondWith({
      kind: 'serialize-success',
      id: retryRequest.id,
      payload: await captureWorkspaceDocument(state),
      autosaveSignature: 'post-crash-autosave-signature',
      historySignature: 'post-crash-history-signature',
    });
    const firstResult = await first;
    expect(firstResult.autosaveSignature).toBe('post-crash-autosave-signature');

    const second = runWorkspaceSerialization(state);
    await flushMicrotasks();
    expect(created[1]?.posted).toHaveLength(2);
    created[1]?.crash();
    await flushMicrotasks();
    expect(created).toHaveLength(3);
    const rebuiltRequest = created[2]?.posted[0];
    if (!rebuiltRequest) throw new Error('rebuilt worker received no request');
    created[2]?.respondWith({
      kind: 'serialize-success',
      id: rebuiltRequest.id,
      payload: await captureWorkspaceDocument(state),
      autosaveSignature: 'after-reset-autosave-signature',
      historySignature: 'after-reset-history-signature',
    });
    const secondResult = await second;
    expect(secondResult.autosaveSignature).toBe('after-reset-autosave-signature');
  });

  it('settles sibling jobs immediately when one job times out', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const state = seedStateWithDirectPage();
    const created = trackFakeWorkers();

    const first = runWorkspaceSerialization(state);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(15_000);
    const second = runWorkspaceSerialization(state);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(15_000);
    await flushMicrotasks();

    const firstResult = await first;
    const secondResult = await second;
    expect(created).toHaveLength(1);
    expect(created[0]?.terminated).toBe(true);
    expect(firstResult.autosaveSignature).toBe(buildWorkspaceAutosaveSignature(state));
    expect(secondResult.autosaveSignature).toBe(buildWorkspaceAutosaveSignature(state));

    const third = runWorkspaceSerialization(state);
    await flushMicrotasks();
    expect(created).toHaveLength(2);
    const nextRequest = created[1]?.posted[0];
    if (!nextRequest) throw new Error('rebuilt worker received no request');
    created[1]?.respondWith({
      kind: 'serialize-success',
      id: nextRequest.id,
      payload: await captureWorkspaceDocument(state),
      autosaveSignature: 'post-timeout-autosave-signature',
      historySignature: 'post-timeout-history-signature',
    });
    const thirdResult = await third;
    expect(thirdResult.autosaveSignature).toBe('post-timeout-autosave-signature');
  });

  it('runs in fallback mode when no Worker exists (jsdom) without warning spam', async () => {
    const warnSpy = vi.spyOn(console, 'warn');
    const errorSpy = vi.spyOn(console, 'error');
    const state = seedStateWithDirectPage();

    const result = await runWorkspaceSerialization(state);

    expect(FakeSerializerWorker.instances).toHaveLength(0);
    expect(result.autosaveSignature).toBe(buildWorkspaceAutosaveSignature(state));
    expect(result.historySignature).toBe(buildWorkspaceHistorySignature(state));
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('workspaceSerializerWorker (real module, same-thread driver)', () => {
  beforeEach(() => {
    resetWorkspaceSerializerForTests();
  });

  afterEach(() => {
    clearImageStore();
  });

  it('computes capture plus both signatures and transfers exactly the asset buffers', async () => {
    const state = await seedStateWithDirectAndArchivePages();
    const captured = await driveWorkerEntry(state);

    expect(captured).toHaveLength(1);
    const first = captured[0];
    if (!first) throw new Error('worker produced no response');
    expect(first.response.kind).toBe('serialize-success');
    if (first.response.kind !== 'serialize-success') return;

    expect(first.response.autosaveSignature).toBe(buildWorkspaceAutosaveSignature(state));
    expect(first.response.historySignature).toBe(buildWorkspaceHistorySignature(state));
    expect(first.response.payload.assets).toHaveLength(state.images.length);
    for (const asset of first.response.payload.assets) {
      expect(asset.buffer.byteLength).toBeGreaterThan(0);
    }
    const responseBuffers = first.response.payload.assets.map((asset) => asset.buffer);
    expect(first.transfer).toHaveLength(responseBuffers.length);
    responseBuffers.forEach((buffer, index) => {
      expect(first.transfer?.[index]).toBe(buffer);
    });
  });

  it('reports through console.error instead of rejecting when the error response cannot be posted', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = seedStateWithDirectPage();
    const scope = {
      onmessage: null as ((event: MessageEvent<WorkspaceSerializeRequest>) => void) | null,
      postMessage: (): void => {
        throw new Error('postMessage bridge is closed');
      },
    };
    attachWorkerScopeForTest(scope);
    if (!scope.onmessage) {
      throw new Error('worker did not register onmessage');
    }
    scope.onmessage(
      new MessageEvent('message', {
        data: {
          kind: 'serialize',
          id: 'entry-request-unreportable',
          state: toWireCaptureState(state),
        } satisfies WorkspaceSerializeRequest,
      }),
    );

    for (let waited = 0; errorSpy.mock.calls.length === 0 && waited < 5000; waited += 10) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toBe(
      '[workspace-serializer] failed to report the serialization error',
    );
    errorSpy.mockRestore();
  });
});
