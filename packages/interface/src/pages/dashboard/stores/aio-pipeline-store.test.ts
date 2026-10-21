import { beforeEach, describe, expect, it } from 'vitest';

// jsdom has no storage backend (same as theme-store.test.ts) — Map-backed
// stub keeps the GPU-preferences and preset rehydration paths honest.
const storageMap = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string): string | null => storageMap.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      storageMap.set(key, value);
    },
    removeItem: (key: string): void => {
      storageMap.delete(key);
    },
    clear: (): void => {
      storageMap.clear();
    },
    key: (): string | null => null,
    length: 0,
  },
});

const { useAioPipelineStore } = await import('@/pages/dashboard/stores/aio-pipeline-store');
const { GPU_STAGES_STORAGE_KEY } = await import(
  '@/pages/dashboard/stores/aio-pipeline-storage'
);

describe('useAioPipelineStore', () => {
  beforeEach(() => {
    storageMap.clear();
    useAioPipelineStore.setState({
      aioGpuStages: {
        detectText: true,
        recognizeText: true,
        segmentText: true,
        cleanImage: true,
      },
      aioPipelineSnapshots: [],
      aioPipelineSnapshotIndex: -1,
      aioImageSnapshotIndexById: {},
      aioAutoHistoryAvailable: false,
      aioAutoProcessedImageById: {},
      aioManualProgressByImage: {},
    });
  });

  it('ignores no-op gpu stage updates and keeps state identity', () => {
    const before = useAioPipelineStore.getState().aioGpuStages;

    useAioPipelineStore.getState().updateAioGpuStage('detectText', before.detectText);

    expect(useAioPipelineStore.getState().aioGpuStages).toBe(before);
    expect(storageMap.has(GPU_STAGES_STORAGE_KEY)).toBe(false);
  });

  it('commits gpu stage changes and persists them', () => {
    useAioPipelineStore.getState().updateAioGpuStage('cleanImage', false);

    const after = useAioPipelineStore.getState().aioGpuStages;
    expect(after.cleanImage).toBe(false);
    expect(after.detectText).toBe(true);
    expect(storageMap.get(GPU_STAGES_STORAGE_KEY)).toBe(JSON.stringify(after));
  });

  it('keeps history invalidate a no-op when already empty', () => {
    const before = useAioPipelineStore.getState();

    useAioPipelineStore.getState().invalidateAioPipelineHistory();

    const after = useAioPipelineStore.getState();
    expect(after.aioPipelineSnapshots).toBe(before.aioPipelineSnapshots);
    expect(after.aioImageSnapshotIndexById).toBe(before.aioImageSnapshotIndexById);
    expect(after.aioAutoProcessedImageById).toBe(before.aioAutoProcessedImageById);
    expect(after.aioManualProgressByImage).toBe(before.aioManualProgressByImage);
  });

  it('resets pipeline history maps in one transaction', () => {
    useAioPipelineStore.setState({
      aioPipelineSnapshots: [
        {
          key: 'detectText',
          label: 's',
          detectionsByImage: { 'img-1': [] },
          selectedRegionByImage: { 'img-1': null },
          aioDownloads: [],
        },
      ],
      aioPipelineSnapshotIndex: 0,
      aioImageSnapshotIndexById: { 'img-1': 0 },
      aioAutoHistoryAvailable: true,
      aioAutoProcessedImageById: { 'img-1': true },
      aioManualProgressByImage: {
        'img-1': {
          currentIndex: 0,
          unlockedMaxIndex: 0,
          statusByStage: {
            detectText: 'pending',
            recognizeText: 'locked',
            getTranslations: 'locked',
            segmentText: 'locked',
            cleanImage: 'locked',
            render: 'locked',
          },
        },
      },
    });

    useAioPipelineStore.getState().invalidateAioPipelineHistory();

    const state = useAioPipelineStore.getState();
    expect(state.aioPipelineSnapshots).toEqual([]);
    expect(state.aioPipelineSnapshotIndex).toBe(-1);
    expect(state.aioImageSnapshotIndexById).toEqual({});
    expect(state.aioAutoHistoryAvailable).toBe(false);
    expect(state.aioAutoProcessedImageById).toEqual({});
    expect(state.aioManualProgressByImage).toEqual({});
  });

  it('skips setter writes when Object.is matches previous value', () => {
    const before = useAioPipelineStore.getState().aioMaskDilation;
    let notified = false;

    const unsubscribe = useAioPipelineStore.subscribe(() => {
      notified = true;
    });

    useAioPipelineStore.getState().setAioMaskDilation(before);
    unsubscribe();

    expect(notified).toBe(false);
    expect(useAioPipelineStore.getState().aioMaskDilation).toBe(before);
  });
});
