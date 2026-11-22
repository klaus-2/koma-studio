import { describe, expect, it, vi } from 'vitest';
import type {
  DesktopForwardedFilesPayload,
  DesktopModelsApi,
  IDesktopBridge,
} from '@shared/desktop-api';

import { createDesktopBridgeStub, type DesktopBridgeStubExtras } from '@/testing/desktop-bridge-stub';

type ForwardedFilesModule = typeof import('./forwarded-files');

const modelsStub: DesktopModelsApi = {
  listInstalled: async () => [],
  getDiskSpace: async () => ({ freeBytes: 1024 ** 3, totalBytes: 1024 ** 3, path: 'mock' }),
  checkUpdates: async () => [],
  download: async () => ({ queued: true, queueLength: 1 }),
  importOnnx: async () => {
    throw new Error('not used in this suite');
  },
  cancel: async () => undefined,
  cancelAll: async () => undefined,
  uninstall: async () => undefined,
  listActive: async () => ({ known: false }),
  on: async () => true,
  off: () => undefined,
};

interface BridgeHarness {
  readonly bridge: IDesktopBridge;
  readonly emitForwardedFiles: (payload: DesktopForwardedFilesPayload) => void;
}

const makeBridgeHarness = (
  extras: DesktopBridgeStubExtras = {},
): BridgeHarness => {
  const listeners = new Set<(payload: DesktopForwardedFilesPayload) => void>();
  const bridge = createDesktopBridgeStub(modelsStub, {
    ...extras,
    onForwardedFiles: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
  return {
    bridge,
    emitForwardedFiles: (payload) => {
      for (const listener of listeners) {
        listener(payload);
      }
    },
  };
};

const loadModule = async (
  bridge: IDesktopBridge | null,
): Promise<ForwardedFilesModule> => {
  vi.resetModules();
  const bridgeModule = await import('@/lib/desktop-bridge');
  bridgeModule.setDesktopBridgeProvider({ desktop: bridge });
  return import('./forwarded-files');
};

const makeIngestionDeps = () => ({
  onDrop: vi.fn<(files: File[]) => Promise<void>>(async () => undefined),
  setStatusMessage: vi.fn<(message: string) => void>(),
});

describe('forwarded-files subscription', () => {
  it('queues first-launch paths emitted before the dashboard attaches and drains them on attach', async () => {
    const harness = makeBridgeHarness();
    const mod = await loadModule(harness.bridge);

    mod.installForwardedFilesSubscription();
    harness.emitForwardedFiles({ paths: ['C:\\comics\\chapter.cbz'] });

    const consumed: string[][] = [];
    mod.setForwardedFilesIngestion((paths) => consumed.push(paths));

    expect(consumed).toEqual([['C:\\comics\\chapter.cbz']]);
  });

  it('routes live events to the attached consumer and detaches on cleanup', async () => {
    const harness = makeBridgeHarness();
    const mod = await loadModule(harness.bridge);

    const live: string[][] = [];
    mod.installForwardedFilesSubscription();
    mod.setForwardedFilesIngestion((paths) => live.push(paths));

    harness.emitForwardedFiles({ paths: ['C:\\a.zip'] });
    expect(live).toEqual([['C:\\a.zip']]);

    mod.setForwardedFilesIngestion(null);
    harness.emitForwardedFiles({ paths: ['C:\\b.zip'] });

    const drained: string[][] = [];
    mod.setForwardedFilesIngestion((paths) => drained.push(paths));
    expect(drained).toEqual([['C:\\b.zip']]);
  });

  it('trims, dedupes, and ignores empty payloads', async () => {
    const harness = makeBridgeHarness();
    const mod = await loadModule(harness.bridge);

    mod.installForwardedFilesSubscription();
    harness.emitForwardedFiles({ paths: ['  C:\\a.zip ', 'C:\\a.zip', '   '] });
    harness.emitForwardedFiles({ paths: [] });

    const drained: string[][] = [];
    mod.setForwardedFilesIngestion((paths) => drained.push(paths));
    expect(drained).toEqual([['C:\\a.zip']]);
  });

  it('installs the bridge listener once across repeated bootstrap calls', async () => {
    const listeners: Array<(payload: DesktopForwardedFilesPayload) => void> = [];
    const bridge = createDesktopBridgeStub(modelsStub, {
      onForwardedFiles: (listener) => {
        listeners.push(listener);
        return () => undefined;
      },
    });
    const mod = await loadModule(bridge);

    mod.installForwardedFilesSubscription();
    mod.installForwardedFilesSubscription();

    expect(listeners).toHaveLength(1);
  });

  it('stays inert when the bridge has no forwarded-files listener', async () => {
    const bridge = createDesktopBridgeStub(modelsStub);
    const mod = await loadModule(bridge);

    expect(() => mod.installForwardedFilesSubscription()).not.toThrow();

    const drained: string[][] = [];
    mod.setForwardedFilesIngestion((paths) => drained.push(paths));
    expect(drained).toEqual([]);
  });
});

describe('ingestForwardedFilePaths', () => {
  it('feeds readable files into the same onDrop import entry', async () => {
    const bytes = new TextEncoder().encode('abcd');
    const readForwarded = vi.fn(async (): Promise<{ data: ArrayBuffer }> => ({
      data: bytes.buffer as ArrayBuffer,
    }));
    const harness = makeBridgeHarness({ filesReadForwarded: readForwarded });
    const mod = await loadModule(harness.bridge);
    const deps = makeIngestionDeps();

    await mod.ingestForwardedFilePaths(['C:\\c\\a.png'], deps);

    expect(readForwarded).toHaveBeenCalledWith({ path: 'C:\\c\\a.png' });
    expect(deps.onDrop).toHaveBeenCalledTimes(1);
    const files = deps.onDrop.mock.calls[0]?.[0] ?? [];
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe('a.png');
    expect(files[0]?.type).toBe('image/png');
    expect(deps.setStatusMessage).not.toHaveBeenCalled();
  });

  it('reports forwarded paths as unreadable when the shell has no read channel', async () => {
    const harness = makeBridgeHarness();
    const mod = await loadModule(harness.bridge);
    const deps = makeIngestionDeps();

    await mod.ingestForwardedFilePaths(['C:\\c\\chapter.cbz'], deps);

    expect(deps.onDrop).not.toHaveBeenCalled();
    expect(deps.setStatusMessage).toHaveBeenCalledTimes(1);
    expect(deps.setStatusMessage.mock.calls[0]?.[0]).toContain('chapter.cbz');
  });

  it('aggregates the failure message and logs when the shell read rejects', async () => {
    const readForwarded = vi.fn(async (): Promise<{ data: ArrayBuffer }> => {
      throw new Error('Path was not forwarded to this session.');
    });
    const harness = makeBridgeHarness({
      filesReadForwarded: readForwarded,
      sessionLog: vi.fn(async () => undefined),
    });
    const mod = await loadModule(harness.bridge);
    const deps = makeIngestionDeps();

    await expect(
      mod.ingestForwardedFilePaths(['C:\\c\\a.png'], deps),
    ).resolves.toBeUndefined();

    expect(harness.bridge.sessionLog).toHaveBeenCalledTimes(1);
    expect(deps.onDrop).not.toHaveBeenCalled();
    expect(deps.setStatusMessage.mock.calls[0]?.[0]).toContain('a.png');
  });

  it('does nothing for an empty batch', async () => {
    const mod = await loadModule(null);
    const deps = makeIngestionDeps();

    await mod.ingestForwardedFilePaths([], deps);

    expect(deps.onDrop).not.toHaveBeenCalled();
    expect(deps.setStatusMessage).not.toHaveBeenCalled();
  });
});
