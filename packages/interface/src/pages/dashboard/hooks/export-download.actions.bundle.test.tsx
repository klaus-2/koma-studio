// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { Suspense, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { createDesktopBridgeStub } from '@/testing/desktop-bridge-stub';
import type { DesktopModelsApi } from '@shared/desktop-api';
import { useDashboardDownloadActions } from './export-download.actions';
import { useExportStore } from '../stores/export-store';
import { useStatusStore } from '../stores/status-store';

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

const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
  <Suspense fallback={null}>
    <I18nProvider>{children}</I18nProvider>
  </Suspense>
);

const stubEntry = {
  fileName: 'page-001.png',
  blob: new Blob(['page']),
  sourceImageId: 'image-1',
};

const prepareDownloadEntries = async () => [stubEntry];

beforeEach(() => {
  setDesktopBridgeProvider({
    desktop: createDesktopBridgeStub(modelsStub),
  });
  useExportStore.setState({
    lastActionScope: 'aio',
    downloadBundleFormat: 'zip',
    lastExportedFilePath: null,
  });
  useStatusStore.setState({ statusMessage: '' });
});

describe('useDashboardDownloadActions shell-bundle branch', () => {
  it('skips the blob download and reports success when the shell wrote the file', async () => {
    const triggerBlobDownload = vi.fn();
    const setDownloadMenuOpen = vi.fn();

    const { result } = renderHook(
      () => useDashboardDownloadActions({
        prepareDownloadEntries,
        buildDownloadBundleBlob: async () => ({
          fileName: 'chapter-1.zip',
          blob: null,
          shellFilePath: 'C:/out/chapter-1.zip',
        }),
        triggerBlobDownload,
        setDownloadMenuOpen,
      }),
      { wrapper },
    );

    await result.current.handleDownload('aio');

    expect(triggerBlobDownload).not.toHaveBeenCalled();
    expect(setDownloadMenuOpen).toHaveBeenCalledWith(false);
    expect(useStatusStore.getState().statusMessage).toBe('Package chapter-1.zip generated successfully.');
  });

  it('aborts silently when the save dialog was cancelled', async () => {
    const triggerBlobDownload = vi.fn();
    const setDownloadMenuOpen = vi.fn();

    const { result } = renderHook(
      () => useDashboardDownloadActions({
        prepareDownloadEntries,
        buildDownloadBundleBlob: async () => ({
          fileName: 'chapter-1.zip',
          blob: null,
          shellFilePath: null,
        }),
        triggerBlobDownload,
        setDownloadMenuOpen,
      }),
      { wrapper },
    );

    await result.current.handleDownload('aio');

    expect(triggerBlobDownload).not.toHaveBeenCalled();
    expect(setDownloadMenuOpen).toHaveBeenCalledWith(false);
    expect(useStatusStore.getState().statusMessage).toBe('');
  });

  it('keeps the blob download path when the bundle was built in JS', async () => {
    const triggerBlobDownload = vi.fn();
    const setDownloadMenuOpen = vi.fn();
    const blob = new Blob(['bytes']);

    const { result } = renderHook(
      () => useDashboardDownloadActions({
        prepareDownloadEntries,
        buildDownloadBundleBlob: async () => ({
          fileName: 'chapter-1.zip',
          blob,
          shellFilePath: null,
        }),
        triggerBlobDownload,
        setDownloadMenuOpen,
      }),
      { wrapper },
    );

    await result.current.handleDownload('aio');

    expect(triggerBlobDownload).toHaveBeenCalledWith(blob, 'chapter-1.zip');
    expect(useStatusStore.getState().statusMessage).toBe('Package chapter-1.zip generated successfully.');
  });
});
