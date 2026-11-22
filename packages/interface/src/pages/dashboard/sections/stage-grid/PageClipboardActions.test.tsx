// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AioTextRegion, LoadedImage } from '@/types/dashboard.types';

import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import type { DesktopModelsApi } from '@shared/desktop-api';
import { createDesktopBridgeStub } from '@/testing/desktop-bridge-stub';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useRegionEditorStore } from '@/pages/dashboard/stores/region-editor-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { createDirectPageFile } from '@/utils/page-source';
import PageClipboardActions from './PageClipboardActions';

vi.mock('../../lib/clipboard-image', () => ({
  hasClipboardImageBridge: vi.fn(() => true),
  copyImageBlobToClipboard: vi.fn(async () => undefined),
  cropImageBlob: vi.fn(async () => new Blob(['region'], { type: 'image/png' })),
}));

import {
  copyImageBlobToClipboard,
  cropImageBlob,
  hasClipboardImageBridge,
} from '../../lib/clipboard-image';

const mockedHasBridge = vi.mocked(hasClipboardImageBridge);
const mockedCopy = vi.mocked(copyImageBlobToClipboard);
const mockedCrop = vi.mocked(cropImageBlob);

const makeImage = (): LoadedImage => ({
  id: 'img-1',
  file: createDirectPageFile(
    new File(['page-bytes'], 'page-1.png', { type: 'image/png' }),
  ),
  url: 'blob:mock-page',
  width: 100,
  height: 80,
  rotation: 0,
  filters: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpen: 0,
    levels: { black: 0, white: 255, gamma: 1 },
    grayscale: false,
    inverted: false,
  },
});

const region: AioTextRegion = {
  id: 'region-1',
  bbox: [10, 10, 60, 40],
  score: 1,
  source: 'model',
  modelKey: 'detector',
};

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

const renderActions = () =>
  render(
    <I18nProvider>
      <PageClipboardActions imageId="img-1" />
    </I18nProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedHasBridge.mockReturnValue(true);
  setDesktopBridgeProvider({
    desktop: createDesktopBridgeStub(modelsStub),
  });
  mockedCopy.mockClear();
  mockedCrop.mockReset();
  mockedCrop.mockImplementation(async () => new Blob(['region'], { type: 'image/png' }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(['page'], { type: 'image/png' }),
    })),
  );
  useImageCollectionStore.setState({ images: [makeImage()], activeId: 'img-1' });
  useRegionEditorStore.setState({
    aioSelectedRegionByImage: {},
    aioDetectionsByImage: {},
  });
  useStatusStore.setState({ statusMessage: '', statusMessageTone: 'info' });
});

describe('PageClipboardActions', () => {
  it('renders nothing when the shell has no clipboard integration', () => {
    mockedHasBridge.mockReturnValue(false);

    const { container } = renderActions();

    expect(container.querySelector('button')).toBeNull();
  });

  it('copies the rendered page through the bridge and toasts success', async () => {
    renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'Copy page image' }));

    await waitFor(() => expect(mockedCopy).toHaveBeenCalledTimes(1));
    const copied = mockedCopy.mock.calls[0]?.[0] ?? null;
    expect(copied).toBeInstanceOf(Blob);
    expect(useStatusStore.getState().statusMessage).toBe(
      'Page copied to the clipboard.',
    );
    expect(useStatusStore.getState().statusMessageTone).toBe('success');
  });

  it('shows the region button only with a selected region and crops its bounds', async () => {
    const { rerender } = renderActions();
    expect(screen.queryByRole('button', { name: 'Copy region image' })).toBeNull();

    useRegionEditorStore.setState({
      aioSelectedRegionByImage: { 'img-1': 'region-1' },
      aioDetectionsByImage: { 'img-1': [region] },
    });
    rerender(
      <I18nProvider>
        <PageClipboardActions imageId="img-1" />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy region image' }));

    await waitFor(() => expect(mockedCrop).toHaveBeenCalledTimes(1));
    expect(mockedCrop.mock.calls[0]?.[1]).toEqual([10, 10, 60, 40]);
    await waitFor(() => expect(mockedCopy).toHaveBeenCalledTimes(1));
    expect(useStatusStore.getState().statusMessage).toBe(
      'Region copied to the clipboard.',
    );
  });

  it('toasts an error tone when the clipboard write fails', async () => {
    mockedCopy.mockRejectedValueOnce(new Error('clipboard write refused'));

    renderActions();
    fireEvent.click(screen.getByRole('button', { name: 'Copy page image' }));

    await waitFor(() =>
      expect(useStatusStore.getState().statusMessage).toBe(
        'Could not copy the image to the clipboard.',
      ),
    );
    expect(useStatusStore.getState().statusMessageTone).toBe('error');
  });
});
