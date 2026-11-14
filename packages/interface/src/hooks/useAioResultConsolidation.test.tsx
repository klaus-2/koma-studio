// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '@/i18n';
import type { AioBatchImageResult, AioTextRegion } from '../types/dashboard.types';
import { useRegionEditorStore } from '../pages/dashboard/stores/region-editor-store';
import { useAioResultConsolidation } from './useAioResultConsolidation';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const region = (
  id: string,
  bbox: [number, number, number, number],
  overrides: Partial<AioTextRegion> = {},
): AioTextRegion => ({
  id,
  bbox,
  score: 0.9,
  source: 'model',
  modelKey: 'fresh-detector',
  ...overrides,
});

const seedStore = (): void => {
  useRegionEditorStore.setState({
    aioDetectionsByImage: {
      'img-1': [
        region('prev-locked', [0, 0, 100, 100], {
          lockedFields: { geometry: true, text: true },
          locked: false,
          renderText: 'kept text',
          recognizedText: 'kept raw',
        }),
      ],
    },
    aioSelectedRegionByImage: { 'img-1': 'prev-locked' },
  });
};

const batchResult = (): AioBatchImageResult => ({
  imageId: 'img-1',
  detectDetections: [region('fresh-detect', [0, 0, 100, 100], { score: 0.8 })],
  ocrDetections: [region('fresh-ocr', [0, 0, 100, 100], { score: 0.8, recognizedText: 'new raw' })],
  translationDetections: [region('fresh-tl', [0, 0, 100, 100], { score: 0.8, translatedText: 'new tl' })],
  segmentDetections: [region('fresh-seg', [0, 0, 100, 100], { score: 0.8 })],
  cleanDetections: [region('fresh-clean', [0, 0, 100, 100], { score: 0.8 })],
  // Later-stage snapshot region overlapping the locked region with a
  // different id (fresh backend ids differ each run).
  renderDetections: [region('fresh-render', [1, 1, 99, 99], { score: 0.7 })],
  cleanedDownload: null,
});

describe('useAioResultConsolidation lock carry-over', () => {
  beforeEach(() => {
    seedStore();
  });

  it('carries locked regions through the latest multi-stage snapshot into the editor store', () => {
    const setAioPipelineSnapshots = vi.fn();
    const { result } = renderHook(
      () =>
        useAioResultConsolidation({
          aioSteps: {
            recognizeText: true,
            getTranslations: false,
            segmentText: false,
            cleanImage: false,
            render: true,
          },
          buildAioImageSnapshotIndexMap: vi.fn(() => ({})),
          setAioAutoProcessedImageById: vi.fn(),
          setAioDetectionsByImage: (value) =>
            useRegionEditorStore.getState().setAioDetectionsByImage(value),
          setAioSelectedRegionByImage: vi.fn(),
          setAioPipelineSnapshots,
          setAioPipelineSnapshotIndex: vi.fn(),
          setAioImageSnapshotIndexById: vi.fn(),
          setAioAutoHistoryAvailable: vi.fn(),
          setAioDownloadItems: vi.fn(),
        }),
      { wrapper: I18nProvider },
    );

    result.current([batchResult()]);

    // The latest (render) snapshot becomes the store state, and the locked
    // region is carried onto the spatially matched fresh region: fresh id,
    // fresh detection metadata, locked geometry/text/flags.
    const store = useRegionEditorStore.getState().aioDetectionsByImage;
    const carried = store['img-1'];
    expect(carried).toHaveLength(1);
    const carriedRegion = carried?.[0];
    expect(carriedRegion?.id).toBe('fresh-render');
    expect(carriedRegion?.bbox).toEqual([0, 0, 100, 100]);
    expect(carriedRegion?.renderText).toBe('kept text');
    expect(carriedRegion?.recognizedText).toBe('kept raw');
    expect(carriedRegion?.lockedFields).toEqual({ geometry: true, text: true });
    expect(carriedRegion?.score).toBe(0.7);
    expect(carriedRegion?.modelKey).toBe('fresh-detector');

    // The detect-stage timeline record reflects DETECT output + locks.
    const detectSnapshot = setAioPipelineSnapshots.mock.calls[0]?.[0]?.[0];
    const detectRegions = detectSnapshot?.detectionsByImage?.['img-1'];
    expect(detectRegions).toHaveLength(1);
    expect(detectRegions?.[0]?.id).toBe('fresh-detect');
    expect(detectRegions?.[0]?.renderText).toBe('kept text');
    expect(detectRegions?.[0]?.lockedFields).toEqual({ geometry: true, text: true });
  });
});
