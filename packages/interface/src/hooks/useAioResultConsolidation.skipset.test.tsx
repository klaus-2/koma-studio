// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '@/i18n';
import type { AioBatchImageResult, AioTextRegion } from '../types/dashboard.types';
import { useRegionEditorStore } from '../pages/dashboard/stores/region-editor-store';
import { useUiShellStore } from '../pages/dashboard/stores/ui-shell-store';
import { useAioBatchPauseStore } from '../pages/dashboard/stores/aio-batch-pause-store';
import { createBatchPauseGate } from '../pages/dashboard/lib/batch-pause-gate';
import { runBatchPauseBoundary } from '../pages/dashboard/lib/batch-pause-boundary';
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
      'img-paused': [
        region('paused-edit', [0, 0, 100, 100], {
          renderText: 'edited during pause',
          recognizedText: 'edited raw',
        }),
      ],
      'img-live': [],
    },
    aioSelectedRegionByImage: {},
  });
};

const batchResult = (imageId: string): AioBatchImageResult => ({
  imageId,
  detectDetections: [region(`fresh-${imageId}`, [0, 0, 100, 100], { score: 0.8 })],
  ocrDetections: [
    region(`ocr-${imageId}`, [0, 0, 100, 100], { score: 0.8, recognizedText: 'new raw' }),
  ],
  translationDetections: [],
  segmentDetections: [],
  cleanDetections: [],
  renderDetections: [region(`render-${imageId}`, [1, 1, 99, 99], { score: 0.7 })],
  cleanedDownload: null,
});

describe('useAioResultConsolidation skip-set (Fase D F1 pause edits)', () => {
  beforeEach(() => {
    seedStore();
  });

  it('preserves pause-edited pages in the new timeline and still counts metrics', () => {
    const setAioPipelineSnapshots = vi.fn();
    const setAioDetectionsByImage = vi.fn(
      (value: Record<string, AioTextRegion[]>) =>
        useRegionEditorStore.getState().setAioDetectionsByImage(value),
    );
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
          setAioDetectionsByImage,
          setAioSelectedRegionByImage: vi.fn(),
          setAioPipelineSnapshots,
          setAioPipelineSnapshotIndex: vi.fn(),
          setAioImageSnapshotIndexById: vi.fn(),
          setAioAutoHistoryAvailable: vi.fn(),
          setAioDownloadItems: vi.fn(),
        }),
      { wrapper: I18nProvider },
    );

    const summary = result.current(
      [batchResult('img-paused'), batchResult('img-live')],
      { skipImageIds: new Set(['img-paused']) },
    );

    expect(summary.totalRecognized).toBe(2);
    expect(summary.processedPagesCount).toBe(2);

    const written = useRegionEditorStore.getState().aioDetectionsByImage;
    expect(written['img-paused']?.[0]?.id).toBe('paused-edit');
    expect(written['img-paused']?.[0]?.renderText).toBe('edited during pause');
    expect(written['img-live']?.[0]?.id).toBe('render-img-live');

    const lastCall =
      setAioPipelineSnapshots.mock.calls[
        setAioPipelineSnapshots.mock.calls.length - 1
      ];
    const timelineCall: unknown = lastCall?.[0];
    const isStageSnapshot = (
      value: unknown,
    ): value is { key: string; detectionsByImage: Record<string, AioTextRegion[]> } =>
      typeof value === 'object' &&
      value !== null &&
      'key' in value &&
      'detectionsByImage' in value;
    const ocrStage = Array.isArray(timelineCall)
      ? timelineCall.find(
          (stage) => isStageSnapshot(stage) && stage.key === 'recognizeText',
        )
      : undefined;
    expect(ocrStage?.detectionsByImage['img-paused']?.[0]?.id).toBe('paused-edit');
    expect(ocrStage?.detectionsByImage['img-live']?.[0]?.id).toBe('ocr-img-live');
  });

  it('behaves exactly as before when no skip set is provided', () => {
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

    result.current([batchResult('img-paused')]);

    const written = useRegionEditorStore.getState().aioDetectionsByImage;
    expect(written['img-paused']?.[0]?.id).toBe('render-img-paused');
  });

  it('keeps every previously consolidated page across MULTIPLE pauses (FIX A)', () => {
    useUiShellStore.setState({ processing: true });
    useRegionEditorStore.setState({
      aioDetectionsByImage: {},
      aioSelectedRegionByImage: {},
    });
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

    const gate = createBatchPauseGate(new AbortController().signal);
    const runSoFar = [batchResult('img-a'), batchResult('img-b')];
    const boundary = (): Promise<void> =>
      runBatchPauseBoundary({
        gate,
        signal: new AbortController().signal,
        getAccumulatedResults: () => runSoFar,
        consolidate: (results, options) => {
          result.current([...results], options);
        },
      });

    useAioBatchPauseStore.getState().requestPause();
    void boundary();
    expect(useRegionEditorStore.getState().aioDetectionsByImage['img-a']?.[0]?.id).toBe('render-img-a');
    expect(useRegionEditorStore.getState().aioDetectionsByImage['img-b']?.[0]?.id).toBe('render-img-b');
    useAioBatchPauseStore.getState().recordPauseConsolidatedImageIds(['img-a', 'img-b']);

    act(() => {
      useRegionEditorStore.getState().setAioDetectionsByImage({
        'img-a': [region('edited-a', [2, 2, 50, 50], { renderText: 'pause edit' })],
        'img-b': useRegionEditorStore.getState().aioDetectionsByImage['img-b'] ?? [],
      });
    });

    useAioBatchPauseStore.getState().resume();
    runSoFar.push(batchResult('img-c'), batchResult('img-d'));
    useUiShellStore.setState({ processing: true });
    useAioBatchPauseStore.getState().requestPause();
    void boundary();

    const written = useRegionEditorStore.getState().aioDetectionsByImage;
    expect(Object.keys(written).sort()).toEqual(['img-a', 'img-b', 'img-c', 'img-d']);
    expect(written['img-a']?.[0]?.id).toBe('edited-a');
    expect(written['img-a']?.[0]?.renderText).toBe('pause edit');
    expect(written['img-b']?.[0]?.id).toBe('render-img-b');
    expect(written['img-c']?.[0]?.id).toBe('render-img-c');
    expect(written['img-d']?.[0]?.id).toBe('render-img-d');

    result.current(runSoFar, {
      skipImageIds: useAioBatchPauseStore.getState().pauseConsolidatedImageIds,
    });
    const finalWritten = useRegionEditorStore.getState().aioDetectionsByImage;
    expect(Object.keys(finalWritten).sort()).toEqual(['img-a', 'img-b', 'img-c', 'img-d']);
    expect(finalWritten['img-a']?.[0]?.id).toBe('edited-a');
    expect(finalWritten['img-b']?.[0]?.id).toBe('render-img-b');
    expect(finalWritten['img-c']?.[0]?.id).toBe('render-img-c');
    expect(finalWritten['img-d']?.[0]?.id).toBe('render-img-d');
  });
});
