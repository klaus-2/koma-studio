import { describe, expect, it, vi } from 'vitest';
import type { DesktopModelsApi } from '@shared/desktop-api';

import { createDesktopBridgeStub } from '@/testing/desktop-bridge-stub';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { showDesktopNotification } from './desktop-notifications';

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

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('showDesktopNotification', () => {
  it('forwards the localized payload to the shell notifications namespace', async () => {
    const show = vi.fn(async () => undefined);
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { notifications: { show } }),
    });

    showDesktopNotification({ title: 'Batch done', body: '3 page(s)' });

    expect(show).toHaveBeenCalledWith({ title: 'Batch done', body: '3 page(s)' });
  });

  it('stays a no-op when the shell has no notifications namespace', () => {
    setDesktopBridgeProvider({ desktop: createDesktopBridgeStub(modelsStub) });

    expect(() =>
      showDesktopNotification({ title: 'Batch done', body: '3 page(s)' }),
    ).not.toThrow();
  });

  it('logs a failed send through the session log without throwing', async () => {
    const show = vi.fn(async () => {
      throw new Error('notification backend unavailable');
    });
    const sessionLog =
      vi.fn<(payload: { level?: string; message: string }) => Promise<void>>(
        async () => undefined,
      );
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        notifications: { show },
        sessionLog,
      }),
    });

    showDesktopNotification({ title: 'Batch done' });
    await flushMicrotasks();

    expect(sessionLog).toHaveBeenCalledTimes(1);
    expect(sessionLog.mock.calls[0]?.[0]?.level).toBe('warn');
    expect(sessionLog.mock.calls[0]?.[0]?.message).toContain('notification backend unavailable');
  });

  it('is a no-op when no desktop bridge exists', () => {
    setDesktopBridgeProvider({ desktop: null });

    expect(() => showDesktopNotification({ title: 'Batch done' })).not.toThrow();
  });
});
