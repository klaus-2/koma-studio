// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopModelsApi } from '@shared/desktop-api';

import { createDesktopBridgeStub } from '@/testing/desktop-bridge-stub';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { useExportStore } from '@/pages/dashboard/stores/export-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useRevealExportedFileAction } from './useRevealExportedFileAction';

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

beforeEach(() => {
  vi.unstubAllGlobals();
  setDesktopBridgeProvider({ desktop: null });
  useExportStore.setState({ lastExportedFilePath: null });
  useStatusStore.setState({
    statusMessage: '',
    statusMessageTone: 'info',
    statusToneExplicit: false,
  });
});

describe('useRevealExportedFileAction', () => {
  it('exposes the last exported path only when the shell has a reveal integration', () => {
    useExportStore.setState({ lastExportedFilePath: 'C:/out/a.zip' });

    const withoutSystem = renderHook(() => useRevealExportedFileAction(), { wrapper: I18nProvider });
    expect(withoutSystem.result.current.filePath).toBe(null);

    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        system: { revealPath: vi.fn(async () => ({ opened: true, path: 'C:/out/a.zip' })) },
      }),
    });

    const withSystem = renderHook(() => useRevealExportedFileAction(), { wrapper: I18nProvider });
    expect(withSystem.result.current.filePath).toBe('C:/out/a.zip');
  });

  it('hides the action when no file was written through the save dialog', () => {
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        system: { revealPath: vi.fn(async () => ({ opened: true, path: null })) },
      }),
    });

    const { result } = renderHook(() => useRevealExportedFileAction(), { wrapper: I18nProvider });
    expect(result.current.filePath).toBe(null);
  });

  it('calls system.revealPath with the exported path', async () => {
    const revealPath = vi.fn(async () => ({ opened: true, path: 'C:/out/a.zip' }));
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { system: { revealPath } }),
    });
    useExportStore.setState({ lastExportedFilePath: 'C:/out/a.zip' });

    const { result } = renderHook(() => useRevealExportedFileAction(), { wrapper: I18nProvider });
    act(() => {
      result.current.reveal();
    });

    await waitFor(() => expect(revealPath).toHaveBeenCalledWith('C:/out/a.zip'));
    expect(useStatusStore.getState().statusMessage).toBe('');
  });

  it('surfaces a warning status when the shell could not reveal the file', async () => {
    const revealPath = vi.fn(async () => ({ opened: false, path: 'C:/out/a.zip' }));
    const sessionLog = vi.fn(async () => undefined);
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        system: { revealPath },
        sessionLog,
      }),
    });
    useExportStore.setState({ lastExportedFilePath: 'C:/out/a.zip' });

    const { result } = renderHook(() => useRevealExportedFileAction(), { wrapper: I18nProvider });
    act(() => {
      result.current.reveal();
    });

    await waitFor(() =>
      expect(useStatusStore.getState().statusMessage).not.toBe(''),
    );
    expect(useStatusStore.getState().statusMessageTone).toBe('warning');
    expect(revealPath).toHaveBeenCalledTimes(1);
  });

  it('stays inert without an exported path', () => {
    const revealPath = vi.fn(async () => ({ opened: true, path: null }));
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { system: { revealPath } }),
    });

    const { result } = renderHook(() => useRevealExportedFileAction(), { wrapper: I18nProvider });
    act(() => {
      result.current.reveal();
    });

    expect(revealPath).not.toHaveBeenCalled();
  });
});
