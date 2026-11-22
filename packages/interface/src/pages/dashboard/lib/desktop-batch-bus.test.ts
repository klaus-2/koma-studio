import { describe, expect, it, vi } from 'vitest';
import type {
  DesktopBatchStatePayload,
  DesktopBatchStateResult,
  DesktopModelsApi,
  IDesktopBridge,
} from '@shared/desktop-api';

import {
  createDesktopBridgeStub,
  type DesktopBridgeStubExtras,
} from '@/testing/desktop-bridge-stub';

type BatchBusModule = typeof import('./desktop-batch-bus');
type PauseStoreModule = typeof import('@/pages/dashboard/stores/aio-batch-pause-store');
type UiShellStoreModule = typeof import('@/pages/dashboard/stores/ui-shell-store');

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

interface BatchBusHarness {
  readonly mod: BatchBusModule;
  readonly pause: PauseStoreModule;
  readonly uiShell: UiShellStoreModule;
}

const loadBus = async (
  extras: DesktopBridgeStubExtras = {},
  desktop: IDesktopBridge | null = createDesktopBridgeStub(modelsStub, extras),
): Promise<BatchBusHarness> => {
  vi.resetModules();
  const bridgeModule = await import('@/lib/desktop-bridge');
  bridgeModule.setDesktopBridgeProvider({ desktop });
  const mod = await import('./desktop-batch-bus');
  const pause = await import('@/pages/dashboard/stores/aio-batch-pause-store');
  const uiShell = await import('@/pages/dashboard/stores/ui-shell-store');
  return { mod, pause, uiShell };
};

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const makeSetStateMock = (
  impl: (state: DesktopBatchStatePayload) => Promise<DesktopBatchStateResult> = async () => ({
    accepted: true,
  }),
) => vi.fn(async (state: DesktopBatchStatePayload) => impl(state));

const makeSessionLogMock = () =>
  vi.fn<(payload: { level?: string; message: string }) => Promise<void>>(
    async () => undefined,
  );

describe('publishBatchState', () => {
  it('forwards phase transitions to the shell batch namespace', async () => {
    const setState = makeSetStateMock();
    const { mod } = await loadBus({ batch: { setState } });

    mod.publishBatchState({ phase: 'running', done: 0, total: 4 });

    expect(setState).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith({ phase: 'running', done: 0, total: 4 });
  });

  it('publishes terminal phases immediately and carries the run totals', async () => {
    const setState = makeSetStateMock();
    const { mod } = await loadBus({ batch: { setState } });

    mod.publishBatchState({ phase: 'running', done: 0, total: 9 });
    mod.publishBatchState({ phase: 'idle', done: 9, total: 9 });
    mod.publishBatchState({ phase: 'error', done: 0, total: 9 });

    expect(setState).toHaveBeenCalledTimes(3);
    expect(setState).toHaveBeenLastCalledWith({ phase: 'error', done: 0, total: 9 });
  });

  it('throttles same-phase running progress to one publish per second', async () => {
    const setState = makeSetStateMock();
    const { mod } = await loadBus({ batch: { setState } });
    let time = 0;
    const now = vi.fn(() => time);

    mod.publishBatchState({ phase: 'running', done: 0, total: 10 }, { now });
    mod.publishBatchState({ phase: 'running', done: 1, total: 10 }, { now });
    time = 500;
    mod.publishBatchState({ phase: 'running', done: 2, total: 10 }, { now });
    time = 1000;
    mod.publishBatchState({ phase: 'running', done: 3, total: 10 }, { now });
    time = 1400;
    mod.publishBatchState({ phase: 'running', done: 4, total: 10 }, { now });
    time = 2400;
    mod.publishBatchState({ phase: 'running', done: 5, total: 10 }, { now });

    expect(setState).toHaveBeenCalledTimes(4);
    expect(setState.mock.calls[0]?.[0]).toEqual({ phase: 'running', done: 0, total: 10 });
    expect(setState.mock.calls[1]?.[0]).toEqual({ phase: 'running', done: 1, total: 10 });
    expect(setState.mock.calls[2]?.[0]).toEqual({ phase: 'running', done: 3, total: 10 });
    expect(setState.mock.calls[3]?.[0]).toEqual({ phase: 'running', done: 5, total: 10 });
  });

  it('never throttles phase transitions even inside the progress window', async () => {
    const setState = makeSetStateMock();
    const { mod } = await loadBus({ batch: { setState } });
    let time = 0;
    const now = vi.fn(() => time);

    mod.publishBatchState({ phase: 'running', done: 0, total: 5 }, { now });
    mod.publishBatchState({ phase: 'running', done: 1, total: 5 }, { now });
    time = 200;
    mod.publishBatchState({ phase: 'paused', done: 1, total: 5 }, { now });
    time = 300;
    mod.publishBatchState({ phase: 'running', done: 1, total: 5 }, { now });
    mod.publishBatchState({ phase: 'running', done: 2, total: 5 }, { now });

    expect(setState).toHaveBeenCalledTimes(4);
    expect(setState).toHaveBeenNthCalledWith(1, { phase: 'running', done: 0, total: 5 });
    expect(setState).toHaveBeenNthCalledWith(2, { phase: 'running', done: 1, total: 5 });
    expect(setState).toHaveBeenNthCalledWith(3, { phase: 'paused', done: 1, total: 5 });
    expect(setState).toHaveBeenNthCalledWith(4, { phase: 'running', done: 1, total: 5 });
  });

  it('logs a rejected setState through the session log without throwing', async () => {
    const setState = makeSetStateMock(async () => {
      throw new Error('shell unavailable');
    });
    const sessionLog = makeSessionLogMock();
    const { mod } = await loadBus({ batch: { setState }, sessionLog });

    expect(() =>
      mod.publishBatchState({ phase: 'running', done: 0, total: 2 }),
    ).not.toThrow();
    await flushMicrotasks();

    expect(sessionLog).toHaveBeenCalledTimes(1);
    expect(sessionLog.mock.calls[0]?.[0]?.level).toBe('warn');
    expect(sessionLog.mock.calls[0]?.[0]?.message).toContain('shell unavailable');
  });

  it('logs a synchronous setState failure without throwing', async () => {
    const setState = vi.fn(
      (_state: DesktopBatchStatePayload): Promise<DesktopBatchStateResult> => {
        throw new Error('sync shell failure');
      },
    );
    const { mod } = await loadBus({ batch: { setState } });

    expect(() =>
      mod.publishBatchState({ phase: 'idle', done: 0, total: 0 }),
    ).not.toThrow();
    expect(setState).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no desktop bridge exists', async () => {
    const { mod } = await loadBus({}, null);

    expect(() =>
      mod.publishBatchState({ phase: 'running', done: 0, total: 1 }),
    ).not.toThrow();
    expect(() => mod.setWindowDirty(true)).not.toThrow();
  });

  it('is a no-op when the shell has no batch namespace', async () => {
    const { mod } = await loadBus({});

    expect(() =>
      mod.publishBatchState({ phase: 'running', done: 0, total: 1 }),
    ).not.toThrow();
  });
});

describe('setWindowDirty', () => {
  it('forwards dirty transitions and dedupes repeated values', async () => {
    const setDirty = vi.fn(async (_payload: { dirty: boolean }) => undefined);
    const { mod } = await loadBus({
      windowState: { setDirty, closeForce: async () => undefined },
    });

    mod.setWindowDirty(true);
    mod.setWindowDirty(true);
    mod.setWindowDirty(false);

    expect(setDirty).toHaveBeenCalledTimes(2);
    expect(setDirty).toHaveBeenNthCalledWith(1, { dirty: true });
    expect(setDirty).toHaveBeenNthCalledWith(2, { dirty: false });
  });

  it('logs a failed dirty publish without throwing', async () => {
    const setDirty = vi.fn(async (_payload: { dirty: boolean }) => {
      throw new Error('dirty channel down');
    });
    const sessionLog = makeSessionLogMock();
    const { mod } = await loadBus({
      windowState: { setDirty, closeForce: async () => undefined },
      sessionLog,
    });

    mod.setWindowDirty(true);
    await flushMicrotasks();

    expect(sessionLog).toHaveBeenCalledTimes(1);
    expect(sessionLog.mock.calls[0]?.[0]?.message).toContain('dirty channel down');
  });

  it('is a no-op when the shell has no windowState namespace', async () => {
    const { mod } = await loadBus({});

    expect(() => mod.setWindowDirty(true)).not.toThrow();
  });
});

describe('pause store mirror', () => {
  it('publishes paused with the last seen running counts and running again on resume', async () => {
    const setState = makeSetStateMock();
    const { mod, pause, uiShell } = await loadBus({ batch: { setState } });
    mod.installDesktopBatchBus();

    mod.publishBatchState({ phase: 'running', done: 2, total: 8 });
    uiShell.useUiShellStore.getState().setProcessing(true);
    pause.useAioBatchPauseStore.getState().requestPause();
    pause.useAioBatchPauseStore.getState().markPaused();

    expect(setState).toHaveBeenLastCalledWith({ phase: 'paused', done: 2, total: 8 });

    pause.useAioBatchPauseStore.getState().resume();

    expect(setState).toHaveBeenLastCalledWith({ phase: 'running', done: 2, total: 8 });
    expect(setState).toHaveBeenCalledTimes(3);
  });

  it('does not publish running again when a terminated run resets the pause store', async () => {
    const setState = makeSetStateMock();
    const { mod, pause } = await loadBus({ batch: { setState } });
    mod.installDesktopBatchBus();

    mod.publishBatchState({ phase: 'running', done: 1, total: 4 });
    mod.publishBatchState({ phase: 'idle', done: 4, total: 4 });
    pause.useAioBatchPauseStore.getState().reset();

    expect(setState).toHaveBeenCalledTimes(2);
    expect(setState).toHaveBeenLastCalledWith({ phase: 'idle', done: 4, total: 4 });
  });

  it('ignores pause store updates that do not change the pause phase', async () => {
    const setState = makeSetStateMock();
    const { mod, pause } = await loadBus({ batch: { setState } });
    mod.installDesktopBatchBus();

    pause.useAioBatchPauseStore.getState().recordPauseConsolidatedImageIds(['a']);

    expect(setState).not.toHaveBeenCalled();
  });

  it('installs the mirror once across repeated bootstrap calls', async () => {
    const setState = makeSetStateMock();
    const { mod, pause, uiShell } = await loadBus({ batch: { setState } });
    mod.installDesktopBatchBus();
    mod.installDesktopBatchBus();
    uiShell.useUiShellStore.getState().setProcessing(true);

    pause.useAioBatchPauseStore.getState().requestPause();
    pause.useAioBatchPauseStore.getState().markPaused();

    expect(setState).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith({ phase: 'paused', done: 0, total: 0 });
  });
});

describe('batch tray action router', () => {
  interface TrayHarness {
    readonly emit: (action: 'pause' | 'resume') => void;
    readonly listenerCount: () => number;
  }

  const makeTrayExtras = (): DesktopBridgeStubExtras & TrayHarness => {
    const listeners = new Set<(payload: { action: 'pause' | 'resume' }) => void>();
    return {
      emit: (action) => {
        for (const listener of listeners) {
          listener({ action });
        }
      },
      listenerCount: () => listeners.size,
      onBatchTrayAction: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  };

  it('routes pause and resume into the pause store entry points', async () => {
    const extras = makeTrayExtras();
    const { mod, pause, uiShell } = await loadBus(extras);
    mod.installDesktopBatchBus();
    uiShell.useUiShellStore.getState().setProcessing(true);

    extras.emit('pause');

    expect(pause.useAioBatchPauseStore.getState().pausePhase).toBe('draining');

    extras.emit('resume');

    expect(pause.useAioBatchPauseStore.getState().pausePhase).toBe('idle');
    expect(pause.useAioBatchPauseStore.getState().pauseRequested).toBe(false);
  });

  it('installs the tray listener once across repeated bootstrap calls', async () => {
    const extras = makeTrayExtras();
    const { mod } = await loadBus(extras);

    mod.installDesktopBatchBus();
    mod.installDesktopBatchBus();

    expect(extras.listenerCount()).toBe(1);
  });

  it('stays inert when the shell has no tray listener', async () => {
    const { mod } = await loadBus({});

    expect(() => mod.installDesktopBatchBus()).not.toThrow();
  });
});
