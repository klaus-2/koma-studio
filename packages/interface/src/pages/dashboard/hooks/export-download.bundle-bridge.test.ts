import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopModelsApi, DesktopSessionLogPayload } from '@shared/desktop-api';

import { createDesktopBridgeStub } from '@/testing/desktop-bridge-stub';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { streamBundleViaShell } from './export-download.bundle-bridge';

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

const bytesOf = (values: readonly number[]): Uint8Array => new Uint8Array(values);

beforeEach(() => {
  setDesktopBridgeProvider(null);
});

describe('streamBundleViaShell', () => {
  it('streams begin, append per entry and finalize in order and returns the file path', async () => {
    const calls: string[] = [];
    const appended: Array<{ name: string; data: ArrayBuffer }> = [];
    const bundle = {
      begin: vi.fn(async () => {
        calls.push('begin');
        return { cancelled: false, sessionId: 'session-1', filePath: 'C:/out/a.cbz' };
      }),
      append: vi.fn(async (payload: { sessionId: string; name: string; data: ArrayBuffer }) => {
        calls.push(`append:${payload.name}`);
        appended.push({ name: payload.name, data: payload.data });
      }),
      finalize: vi.fn(async () => {
        calls.push('finalize');
        return { filePath: 'C:/out/a.cbz' };
      }),
    };
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { bundle }),
    });

    const entryBytes = bytesOf([1, 2, 3, 4]);
    const outcome = await streamBundleViaShell('cbz', 'chapter-1.cbz', [
      { path: 'images/001-page.png', bytes: entryBytes },
      { path: 'texts/raw/001-page.txt', bytes: bytesOf([104, 105]) },
    ]);

    expect(bundle.begin).toHaveBeenCalledWith({ extension: 'cbz', defaultFileName: 'chapter-1.cbz' });
    expect(bundle.append).toHaveBeenCalledTimes(2);
    expect(bundle.finalize).toHaveBeenCalledWith({ sessionId: 'session-1' });
    expect(calls).toEqual(['begin', 'append:images/001-page.png', 'append:texts/raw/001-page.txt', 'finalize']);
    expect(new Uint8Array(appended[0]?.data ?? new ArrayBuffer(0))).toEqual(entryBytes);
    expect(outcome).toEqual({ cancelled: false, filePath: 'C:/out/a.cbz' });
  });

  it('aborts silently when the shell dialog is cancelled', async () => {
    const bundle = {
      begin: vi.fn(async () => ({ cancelled: true, sessionId: null, filePath: null })),
      append: vi.fn(async () => undefined),
      finalize: vi.fn(async () => ({ filePath: null })),
    };
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { bundle }),
    });

    const outcome = await streamBundleViaShell('zip', 'a.zip', [
      { path: 'images/001-page.png', bytes: bytesOf([1]) },
    ]);

    expect(outcome).toEqual({ cancelled: true, filePath: null });
    expect(bundle.append).not.toHaveBeenCalled();
    expect(bundle.finalize).not.toHaveBeenCalled();
  });

  it('returns null when the bridge has no bundle member', async () => {
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub),
    });

    const outcome = await streamBundleViaShell('zip', 'a.zip', [
      { path: 'images/001-page.png', bytes: bytesOf([1]) },
    ]);

    expect(outcome).toBeNull();
  });

  it('falls back with null and logs when begin fails', async () => {
    const sessionLog = vi.fn(async (_payload: DesktopSessionLogPayload) => undefined);
    const bundle = {
      begin: vi.fn(async () => {
        throw new Error('dialog crashed');
      }),
      append: vi.fn(async () => undefined),
      finalize: vi.fn(async () => ({ filePath: null })),
    };
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { bundle, sessionLog }),
    });

    const outcome = await streamBundleViaShell('zip', 'a.zip', [
      { path: 'images/001-page.png', bytes: bytesOf([1]) },
    ]);

    expect(outcome).toBeNull();
    expect(sessionLog).toHaveBeenCalledTimes(1);
    expect(sessionLog.mock.calls[0]?.[0]).toMatchObject({ level: 'warn', source: 'renderer' });
    expect(String(sessionLog.mock.calls[0]?.[0]?.message)).toContain('dialog crashed');
    expect(bundle.append).not.toHaveBeenCalled();
  });

  it('falls back with null and logs when an append fails mid-stream', async () => {
    const sessionLog = vi.fn(async (_payload: DesktopSessionLogPayload) => undefined);
    const bundle = {
      begin: vi.fn(async () => ({ cancelled: false, sessionId: 'session-1', filePath: 'C:/out/a.zip' })),
      append: vi.fn(async (payload: { name: string }) => {
        if (payload.name === 'images/002-page.png') {
          throw new Error('ipc write failed');
        }
      }),
      finalize: vi.fn(async () => ({ filePath: null })),
    };
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { bundle, sessionLog }),
    });

    const outcome = await streamBundleViaShell('zip', 'a.zip', [
      { path: 'images/001-page.png', bytes: bytesOf([1]) },
      { path: 'images/002-page.png', bytes: bytesOf([2]) },
    ]);

    expect(outcome).toBeNull();
    expect(bundle.append).toHaveBeenCalledTimes(2);
    expect(bundle.finalize).not.toHaveBeenCalled();
    expect(String(sessionLog.mock.calls[0]?.[0]?.message)).toContain('ipc write failed');
  });

  it('copies byte views that do not own their whole buffer', async () => {
    const appended: ArrayBuffer[] = [];
    const bundle = {
      begin: vi.fn(async () => ({ cancelled: false, sessionId: 's', filePath: null })),
      append: vi.fn(async (payload: { data: ArrayBuffer }) => {
        appended.push(payload.data);
      }),
      finalize: vi.fn(async () => ({ filePath: 'C:/out/a.zip' })),
    };
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { bundle }),
    });

    const backing = bytesOf([9, 8, 7, 6, 5]);
    const view = backing.subarray(1, 4);
    await streamBundleViaShell('zip', 'a.zip', [{ path: 'images/001.png', bytes: view }]);

    expect(appended).toHaveLength(1);
    expect(new Uint8Array(appended[0] ?? new ArrayBuffer(0))).toEqual(bytesOf([8, 7, 6]));
  });
});
