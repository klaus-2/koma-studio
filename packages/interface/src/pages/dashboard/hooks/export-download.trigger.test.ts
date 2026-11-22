// @vitest-environment jsdom

import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopModelsApi } from '@shared/desktop-api';

import { createDesktopBridgeStub } from '@/testing/desktop-bridge-stub';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { useExportStore } from '@/pages/dashboard/stores/export-store';
import { triggerBlobDownload } from './export-download';

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

const stubAnchorDownload = (): { createObjectURL: ReturnType<typeof vi.fn> } => {
  const createObjectURL = vi.fn(() => 'blob:mock');
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURL,
  });
  return { createObjectURL };
};

beforeEach(() => {
  vi.unstubAllGlobals();
  useExportStore.setState({ lastExportedFilePath: null });
});

describe('triggerBlobDownload filePath propagation', () => {
  it('records the shell-written path when the save dialog succeeds', async () => {
    const saveBlob = vi.fn(async () => ({ cancelled: false, filePath: 'C:/out/a.zip' }));
    const { createObjectURL } = stubAnchorDownload();
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        files: { saveBlob },
      }),
    });

    triggerBlobDownload(new Blob(['data']), 'a.zip');
    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(1));

    expect(useExportStore.getState().lastExportedFilePath).toBe('C:/out/a.zip');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('clears the path and falls back to the anchor download on cancel', async () => {
    const saveBlob = vi.fn(async () => ({ cancelled: true, filePath: null }));
    const { createObjectURL } = stubAnchorDownload();
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { files: { saveBlob } }),
    });

    triggerBlobDownload(new Blob(['data']), 'a.zip');
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));

    expect(useExportStore.getState().lastExportedFilePath).toBe(null);
  });

  it('clears the path when the shell save command fails', async () => {
    const saveBlob = vi.fn(async () => {
      throw new Error('save failed');
    });
    const { createObjectURL } = stubAnchorDownload();
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { files: { saveBlob } }),
    });

    triggerBlobDownload(new Blob(['data']), 'a.zip');
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));

    expect(useExportStore.getState().lastExportedFilePath).toBe(null);
  });

  it('keeps the path null for the browser download path', async () => {
    const { createObjectURL } = stubAnchorDownload();
    setDesktopBridgeProvider({ desktop: null });

    triggerBlobDownload(new Blob(['data']), 'a.zip');
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));

    expect(useExportStore.getState().lastExportedFilePath).toBe(null);
  });
});
