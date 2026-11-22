import { describe, expect, it, vi } from 'vitest';
import type { DesktopModelsApi, IDesktopBridge } from '@shared/desktop-api';

import { createDesktopBridgeStub, type DesktopBridgeStubExtras } from '@/testing/desktop-bridge-stub';

type CloseGuardModule = typeof import('./desktop-close-guard');

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

interface CloseGuardHarness {
  readonly bridge: IDesktopBridge;
  readonly emitCloseRequest: (payload: {
    hasUnsavedWork: boolean;
    batchRunning: boolean;
  }) => void;
}

const makeBridgeHarness = (
  extras: DesktopBridgeStubExtras = {},
): CloseGuardHarness => {
  const listeners = new Set<(payload: {
    hasUnsavedWork: boolean;
    batchRunning: boolean;
  }) => void>();
  const bridge = createDesktopBridgeStub(modelsStub, {
    ...extras,
    onCloseRequested: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
  return {
    bridge,
    emitCloseRequest: (payload) => {
      for (const listener of listeners) {
        listener(payload);
      }
    },
  };
};

const loadModule = async (
  bridge: IDesktopBridge | null,
): Promise<CloseGuardModule> => {
  vi.resetModules();
  const bridgeModule = await import('@/lib/desktop-bridge');
  bridgeModule.setDesktopBridgeProvider({ desktop: bridge });
  return import('./desktop-close-guard');
};

describe('close guard subscription', () => {
  it('buffers requests emitted before the consumer attaches and drains them on attach', async () => {
    const harness = makeBridgeHarness();
    const mod = await loadModule(harness.bridge);

    mod.installCloseGuardSubscription();
    harness.emitCloseRequest({ hasUnsavedWork: true, batchRunning: false });

    const consumed: Array<{ hasUnsavedWork: boolean; batchRunning: boolean }> = [];
    mod.setCloseGuardConsumer((request) => consumed.push(request));

    expect(consumed).toEqual([{ hasUnsavedWork: true, batchRunning: false }]);
  });

  it('routes live requests to the attached consumer and re-buffers after detach', async () => {
    const harness = makeBridgeHarness();
    const mod = await loadModule(harness.bridge);

    const live: Array<{ hasUnsavedWork: boolean; batchRunning: boolean }> = [];
    mod.installCloseGuardSubscription();
    mod.setCloseGuardConsumer((request) => live.push(request));

    harness.emitCloseRequest({ hasUnsavedWork: false, batchRunning: true });
    expect(live).toEqual([{ hasUnsavedWork: false, batchRunning: true }]);

    mod.setCloseGuardConsumer(null);
    harness.emitCloseRequest({ hasUnsavedWork: true, batchRunning: true });

    const drained: Array<{ hasUnsavedWork: boolean; batchRunning: boolean }> = [];
    mod.setCloseGuardConsumer((request) => drained.push(request));
    expect(drained).toEqual([{ hasUnsavedWork: true, batchRunning: true }]);
  });

  it('installs the bridge listener once across repeated bootstrap calls', async () => {
    const listeners: Array<(payload: {
      hasUnsavedWork: boolean;
      batchRunning: boolean;
    }) => void> = [];
    const bridge = createDesktopBridgeStub(modelsStub, {
      onCloseRequested: (listener) => {
        listeners.push(listener);
        return () => undefined;
      },
    });
    const mod = await loadModule(bridge);

    mod.installCloseGuardSubscription();
    mod.installCloseGuardSubscription();

    expect(listeners).toHaveLength(1);
  });

  it('stays inert when the bridge has no close-request listener', async () => {
    const bridge = createDesktopBridgeStub(modelsStub);
    const mod = await loadModule(bridge);

    expect(() => mod.installCloseGuardSubscription()).not.toThrow();

    const consumed: Array<{ hasUnsavedWork: boolean; batchRunning: boolean }> = [];
    mod.setCloseGuardConsumer((request) => consumed.push(request));
    expect(consumed).toEqual([]);
  });
});
