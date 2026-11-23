// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AioTextRegion, LoadedImage } from '../../../types/dashboard.types';
import { useExportDownloadAvailability } from './export-download.availability';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useExportStore } from '../stores/export-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useUiShellStore } from '../stores/ui-shell-store';

const page = {
  id: 'img-1',
  file: { name: 'p1.png', type: 'image/png' },
} as unknown as LoadedImage;

const region = (texts: Partial<AioTextRegion>): AioTextRegion =>
  ({ id: 'r1', bbox: [0, 0, 10, 10], ...texts }) as AioTextRegion;

const renderAvailability = () =>
  renderHook(() => useExportDownloadAvailability({ activeImage: page })).result.current;

beforeEach(() => {
  useUiShellStore.setState({ mode: 'aio' });
  useImageCollectionStore.setState({ images: [page] });
  useAioPipelineStore.setState((state) => ({
    aioSteps: { ...state.aioSteps, cleanImage: false, render: false },
  }));
  useExportStore.setState({ downloadItems: [], lastActionScope: null });
  useRegionEditorStore.setState({ aioDetectionsByImage: {} });
});

describe('useExportDownloadAvailability AIO text output', () => {
  it('enables the download for recognized text with Clean and Render off', () => {
    useRegionEditorStore.setState({
      aioDetectionsByImage: { 'img-1': [region({ recognizedText: 'こんにちは' })] },
    });

    const availability = renderAvailability();

    expect(availability.hasDownloads).toBe(true);
    expect(availability.activeDownloadScope).toBe('aio');
  });

  it('enables the download for translated text alone', () => {
    useRegionEditorStore.setState({
      aioDetectionsByImage: { 'img-1': [region({ translatedText: 'Olá' })] },
    });

    expect(renderAvailability().hasDownloads).toBe(true);
  });

  it('keeps the download disabled when the regions carry no text', () => {
    useRegionEditorStore.setState({
      aioDetectionsByImage: {
        'img-1': [region({ recognizedText: '   ', translatedText: '' })],
      },
    });

    expect(renderAvailability().hasDownloads).toBe(false);
  });

  it('ignores AIO text outside the AIO mode', () => {
    useUiShellStore.setState({ mode: 'cleaner' });
    useRegionEditorStore.setState({
      aioDetectionsByImage: { 'img-1': [region({ recognizedText: 'abc' })] },
    });

    expect(renderAvailability().hasDownloads).toBe(false);
  });
});
