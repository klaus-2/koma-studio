import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const AIO_CLEAN_VIA_AI_STORAGE_KEY = 'koma-aio-clean-via-ai';
const AIO_CLEAN_AI_MODEL_STORAGE_KEY = 'koma-aio-clean-ai-model';
const AIO_CLEAN_AI_INSTRUCTIONS_STORAGE_KEY = 'koma-aio-clean-ai-instructions';
const AIO_AI_ENABLED_STORAGE_KEY = 'koma-aio-ai-enabled';

describe('useAioPipelineStore', () => {
  beforeEach(() => {
    storageMap.clear();
    useAioPipelineStore.setState({
      aioAiEnabled: false,
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

  it('stores a preset editor draft passed as a direct value', () => {
    const nextDraft = {
      ...useAioPipelineStore.getState().aioPresetEditorDraft,
      name: 'Direct draft',
    };

    useAioPipelineStore.getState().setAioPresetEditorDraft(nextDraft);

    expect(useAioPipelineStore.getState().aioPresetEditorDraft).toBe(nextDraft);
  });

  it('applies a functional preset editor draft update against the previous draft', () => {
    const before = useAioPipelineStore.getState().aioPresetEditorDraft;

    useAioPipelineStore.getState().setAioPresetEditorDraft((prev) => ({
      ...prev,
      description: 'Functional draft',
    }));

    const after = useAioPipelineStore.getState().aioPresetEditorDraft;
    expect(after).not.toBe(before);
    expect(after.description).toBe('Functional draft');
    expect(after.name).toBe(before.name);
  });

  it('commits the ai clean toggle and persists it', () => {
    useAioPipelineStore.getState().setAioCleanViaAi(true);

    expect(useAioPipelineStore.getState().aioCleanViaAi).toBe(true);
    expect(storageMap.get(AIO_CLEAN_VIA_AI_STORAGE_KEY)).toBe('true');

    useAioPipelineStore.getState().setAioCleanViaAi(false);
    expect(useAioPipelineStore.getState().aioCleanViaAi).toBe(false);
    expect(storageMap.get(AIO_CLEAN_VIA_AI_STORAGE_KEY)).toBe('false');
  });

  it('keeps an unchanged ai clean toggle a no-op without storage writes', () => {
    useAioPipelineStore.getState().setAioCleanViaAi(false);
    expect(storageMap.has(AIO_CLEAN_VIA_AI_STORAGE_KEY)).toBe(false);
  });

  it('persists the ai clean model key and instructions', () => {
    useAioPipelineStore.getState().setAioCleanAiModelKey('custom_clean:abc');
    useAioPipelineStore.getState().setAioCleanAiInstructions('Keep linework');

    expect(useAioPipelineStore.getState().aioCleanAiModelKey).toBe('custom_clean:abc');
    expect(useAioPipelineStore.getState().aioCleanAiInstructions).toBe('Keep linework');
    expect(storageMap.get(AIO_CLEAN_AI_MODEL_STORAGE_KEY)).toBe('custom_clean:abc');
    expect(storageMap.get(AIO_CLEAN_AI_INSTRUCTIONS_STORAGE_KEY)).toBe('Keep linework');
  });

  it('restores ai clean fields from storage on a fresh store instance', async () => {
    storageMap.set(AIO_CLEAN_VIA_AI_STORAGE_KEY, 'true');
    storageMap.set(AIO_CLEAN_AI_MODEL_STORAGE_KEY, 'custom_clean:restored');
    storageMap.set(AIO_CLEAN_AI_INSTRUCTIONS_STORAGE_KEY, 'From storage');

    vi.resetModules();
    const { useAioPipelineStore: freshStore } = await import(
      '@/pages/dashboard/stores/aio-pipeline-store'
    );

    expect(freshStore.getState().aioCleanViaAi).toBe(true);
    expect(freshStore.getState().aioCleanAiModelKey).toBe('custom_clean:restored');
    expect(freshStore.getState().aioCleanAiInstructions).toBe('From storage');
  });

  it('persists aio ai model, instructions, options, and model config and clears baked ids on history invalidation', async () => {
    const store = useAioPipelineStore.getState();
    store.setAioAiModelKey('custom_clean:gemini-image');
    store.setAioAiInstructions('Match comic lettering');
    store.setAioAiOptions({
      executionMode: 'hybrid_guided',
      sfxMode: 'keep',
      styleMode: 'clean_comic',
      refineAlignment: true,
      preserveArtwork: true,
      skipEmptyPages: false,
    });
    store.setAioAiModelConfig({
      ...store.aioAiModelConfig,
      imageQuality: '2k',
      aspectRatioStrategy: 'pad_unpad',
      seed: 123,
    });
    store.setAioCleanAiModelConfig({
      ...store.aioCleanAiModelConfig,
      slicingMode: 'custom',
      segmentHeight: 1600,
    });
    store.setAioAiBakedImageIds({ img1: true });

    expect(useAioPipelineStore.getState().aioAiBakedImageIds).toEqual({ img1: true });
    useAioPipelineStore.getState().invalidateAioPipelineHistory();
    expect(useAioPipelineStore.getState().aioAiBakedImageIds).toEqual({});

    vi.resetModules();
    const { useAioPipelineStore: freshStore } = await import(
      '@/pages/dashboard/stores/aio-pipeline-store'
    );
    const restored = freshStore.getState();
    expect(restored.aioAiModelKey).toBe('custom_clean:gemini-image');
    expect(restored.aioAiInstructions).toBe('Match comic lettering');
    expect(restored.aioAiOptions).toMatchObject({
      executionMode: 'hybrid_guided',
      sfxMode: 'keep',
      preserveArtwork: true,
      skipEmptyPages: false,
    });
    expect(restored.aioAiModelConfig).toMatchObject({
      imageQuality: '2k',
      aspectRatioStrategy: 'pad_unpad',
      seed: 123,
    });
    expect(restored.aioCleanAiModelConfig).toMatchObject({
      slicingMode: 'custom',
      segmentHeight: 1600,
    });
  });

  it('commits, persists, skips unchanged writes for, and restores aioAiEnabled', async () => {
    expect(useAioPipelineStore.getState().aioAiEnabled).toBe(false);

    useAioPipelineStore.getState().setAioAiEnabled(false);
    expect(storageMap.has(AIO_AI_ENABLED_STORAGE_KEY)).toBe(false);

    useAioPipelineStore.getState().setAioAiEnabled(true);
    expect(useAioPipelineStore.getState().aioAiEnabled).toBe(true);
    expect(storageMap.get(AIO_AI_ENABLED_STORAGE_KEY)).toBe('true');

    vi.resetModules();
    const { useAioPipelineStore: freshStore } = await import(
      '@/pages/dashboard/stores/aio-pipeline-store'
    );
    expect(freshStore.getState().aioAiEnabled).toBe(true);

    freshStore.getState().setAioAiEnabled(false);
    expect(freshStore.getState().aioAiEnabled).toBe(false);
    expect(storageMap.get(AIO_AI_ENABLED_STORAGE_KEY)).toBe('false');
  });
});
