// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { Suspense, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DesktopModelsApi,
  DesktopSessionLogPayload,
  DesktopWatchFileEvent,
} from '@shared/desktop-api';

import { createDesktopBridgeStub } from '@/testing/desktop-bridge-stub';
import { setDesktopBridgeProvider, type DesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '@/i18n';
import { useWatchFolder } from './useWatchFolder';
import {
  ingestForwardedFilePaths,
  setForwardedFilesIngestion,
} from '../lib/forwarded-files';

const modelsStub: DesktopModelsApi = {
  listInstalled: async () => [],
  getDiskSpace: async () => ({ freeBytes: 1, totalBytes: 1, path: 'mock' }),
  checkUpdates: async () => [],
  download: async () => ({ queued: true, queueLength: 0 }),
  importOnnx: async () => {
    throw new Error('not used');
  },
  cancel: async () => undefined,
  cancelAll: async () => undefined,
  uninstall: async () => undefined,
  listActive: async () => ({ known: false }),
  on: async () => true,
  off: () => undefined,
};

const t = (key: string): string => key;

const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
  <Suspense fallback={null}>
    <I18nProvider>{children}</I18nProvider>
  </Suspense>
);

type WatchFileListener = (payload: DesktopWatchFileEvent) => void;

interface WatchHarness {
  readonly start: (payload: { folderPath: string }) => Promise<{ watching: boolean; error?: string }>;
  readonly stop: () => Promise<void>;
  readonly unsubscribe: () => void;
  readonly onWatchFile: (listener: WatchFileListener) => () => void;
  readonly emitWatchFile: (payload: DesktopWatchFileEvent) => void;
}

const makeWatchHarness = (
  startResult: { watching: boolean; error?: string } = { watching: true },
): WatchHarness => {
  const holder: { listener: WatchFileListener | null } = { listener: null };
  const unsubscribe = vi.fn(() => undefined);
  const start = vi.fn(
    async (_payload: { folderPath: string }): Promise<{ watching: boolean; error?: string }> =>
      startResult,
  );
  const stop = vi.fn(async (): Promise<void> => undefined);
  const onWatchFile = vi.fn((registered: WatchFileListener): (() => void) => {
    holder.listener = registered;
    return unsubscribe;
  });
  const bridge = createDesktopBridgeStub(modelsStub, {
    watch: { start, stop },
    onWatchFile,
  });
  setDesktopBridgeProvider({ desktop: bridge });
  return {
    start,
    stop,
    unsubscribe,
    onWatchFile,
    emitWatchFile: (payload) => holder.listener?.(payload),
  };
};

interface PickDialogSpy {
  readonly invoke: NonNullable<DesktopBridgeProvider["invokeCommand"]>;
  readonly calls: Array<[string, Record<string, unknown> | undefined]>;
}

const pickDialogMock = (): PickDialogSpy => {
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  const invoke: NonNullable<DesktopBridgeProvider["invokeCommand"]> = <TResponse,>(
    channel: string,
    args?: Record<string, unknown>,
  ): Promise<TResponse> => {
    calls.push([channel, args]);
    return Promise.resolve('C:/watch' as TResponse);
  };
  return { invoke, calls };
};

interface IngestionSpy {
  readonly dropped: File[][];
  readonly register: () => void;
}

const ingestSpy = (): IngestionSpy => {
  const dropped: File[][] = [];
  const onDrop = async (files: File[]): Promise<void> => {
    dropped.push(files);
  };
  return {
    dropped,
    register: () => {
      setForwardedFilesIngestion((paths) => {
        void ingestForwardedFilePaths(paths, {
          onDrop,
          setStatusMessage: () => undefined,
        });
      });
    },
  };
};

beforeEach(() => {
  setDesktopBridgeProvider(null);
  setForwardedFilesIngestion(null);
});

afterEach(() => {
  setDesktopBridgeProvider(null);
  setForwardedFilesIngestion(null);
});

describe('useWatchFolder', () => {
  it('reports availability only when the watch bridge exists', () => {
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub),
    });
    const { result } = renderHook(() => useWatchFolder({ t }), { wrapper });
    expect(result.current.available).toBe(false);

    makeWatchHarness();
    const withBridge = renderHook(() => useWatchFolder({ t }), { wrapper });
    expect(withBridge.result.current.available).toBe(true);
    expect(withBridge.result.current.active).toBe(false);
  });

  it('picks a folder, starts the watch and surfaces the watching state', async () => {
    const harness = makeWatchHarness();
    const pickDialog = pickDialogMock();
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        watch: { start: harness.start, stop: harness.stop },
        onWatchFile: harness.onWatchFile,
      }),
      invokeCommand: pickDialog.invoke,
    });

    const { result } = renderHook(() => useWatchFolder({ t }), { wrapper });
    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.active).toBe(true));

    expect(pickDialog.calls).toHaveLength(1);
    expect(pickDialog.calls[0]?.[0]).toBe('plugin:dialog|open');
    expect(harness.start).toHaveBeenCalledWith({ folderPath: 'C:/watch' });
    expect(result.current.folderPath).toBe('C:/watch');
    expect(result.current.error).toBeNull();
  });

  it('routes incoming watch files through the forwarded-files ingestion path', async () => {
    const harness = makeWatchHarness();
    const pickDialog = pickDialogMock();
    const readForwarded = vi.fn(async ({ path }: { path: string }) => ({
      data: new TextEncoder().encode(`watched:${path}`).buffer as ArrayBuffer,
    }));
    const ingestion = ingestSpy();
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        watch: { start: harness.start, stop: harness.stop },
        onWatchFile: harness.onWatchFile,
        filesReadForwarded: readForwarded,
      }),
      invokeCommand: pickDialog.invoke,
    });
    ingestion.register();

    const { result } = renderHook(() => useWatchFolder({ t }), { wrapper });
    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.active).toBe(true));

    harness.emitWatchFile({ filePath: 'C:/watch/02.png', fileName: '02.png' });

    await waitFor(() => expect(ingestion.dropped).toHaveLength(1));
    const droppedFiles = ingestion.dropped[0] ?? [];
    expect(droppedFiles).toHaveLength(1);
    expect(droppedFiles[0]?.name).toBe('02.png');
    await waitFor(() => expect(readForwarded).toHaveBeenCalledWith({ path: 'C:/watch/02.png' }));
  });

  it('ignores incoming watch files while inactive', async () => {
    const harness = makeWatchHarness();
    const ingestion = ingestSpy();
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        watch: { start: harness.start, stop: harness.stop },
        onWatchFile: harness.onWatchFile,
        filesReadForwarded: vi.fn(async () => ({ data: new ArrayBuffer(1) })),
      }),
    });
    ingestion.register();

    renderHook(() => useWatchFolder({ t }), { wrapper });
    harness.emitWatchFile({ filePath: 'C:/watch/03.png', fileName: '03.png' });
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(ingestion.dropped).toHaveLength(0);
  });

  it('stops the watch and unsubscribes on toggle-off', async () => {
    const harness = makeWatchHarness();
    const pickDialog = pickDialogMock();
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        watch: { start: harness.start, stop: harness.stop },
        onWatchFile: harness.onWatchFile,
      }),
      invokeCommand: pickDialog.invoke,
    });

    const { result } = renderHook(() => useWatchFolder({ t }), { wrapper });
    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.active).toBe(true));

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.active).toBe(false));

    expect(harness.stop).toHaveBeenCalledTimes(1);
    expect(result.current.folderPath).toBeNull();
  });

  it('stops the watch on unmount', async () => {
    const harness = makeWatchHarness();
    const pickDialog = pickDialogMock();
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        watch: { start: harness.start, stop: harness.stop },
        onWatchFile: harness.onWatchFile,
      }),
      invokeCommand: pickDialog.invoke,
    });

    const { result, unmount } = renderHook(() => useWatchFolder({ t }), { wrapper });
    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.active).toBe(true));

    unmount();
    await waitFor(() => expect(harness.stop).toHaveBeenCalledTimes(1));
    expect(harness.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('shows the shell error without activating when start fails', async () => {
    const harness = makeWatchHarness({ watching: false, error: 'The watch folder path is invalid.' });
    const pickDialog = pickDialogMock();
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        watch: { start: harness.start, stop: harness.stop },
        onWatchFile: harness.onWatchFile,
      }),
      invokeCommand: pickDialog.invoke,
    });

    const { result } = renderHook(() => useWatchFolder({ t }), { wrapper });
    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.error).toBe('The watch folder path is invalid.'));

    expect(result.current.active).toBe(false);
    expect(result.current.folderPath).toBeNull();
  });

  it('falls back to the localized message and logs when start throws', async () => {
    const sessionLog = vi.fn(async (_payload: DesktopSessionLogPayload) => undefined);
    const start = vi.fn(async () => {
      throw new Error('ipc down');
    });
    const pickDialog = pickDialogMock();
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        watch: { start, stop: vi.fn(async () => undefined) },
        onWatchFile: vi.fn(() => vi.fn(() => undefined)),
        sessionLog,
      }),
      invokeCommand: pickDialog.invoke,
    });

    const { result } = renderHook(() => useWatchFolder({ t }), { wrapper });
    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.error).toBe('dashboard.watchFolder.startFailed'));

    expect(result.current.active).toBe(false);
    expect(sessionLog).toHaveBeenCalledTimes(1);
  });
});
