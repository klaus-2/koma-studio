import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AioStageOption } from '@/models/aioStageCatalog';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useLlmProvidersStore } from '@/pages/dashboard/stores/llm-providers-store';
import { TRANSLATION_AUTO_MODEL_KEY } from '@/utils/translationAutoResolution';
import { useAioStageSelectionFallbacks } from './aio-pipeline.runtime';

type FallbackArgs = Parameters<typeof useAioStageSelectionFallbacks>[0];

const cloudOption: AioStageOption = {
  key: 'google_translate',
  name: 'Google Translate',
  device: 'cpu',
  use_case: 'translation',
  available: true,
  implemented: true,
};

const fallbackArgs = (
  translationOptions: readonly AioStageOption[],
): FallbackArgs => ({
  availableDetectStageOptions: [],
  availableOcrStageOptions: [],
  availableTranslationStageOptions: translationOptions,
  availableSegmentStageOptions: [],
  availableCleanStageOptions: [],
  selectedCustomOcrProfile: null,
  selectedCustomTranslationProfile: null,
  isInstalledLocalAioEntry: () => false,
});

describe('useAioStageSelectionFallbacks Auto reconciliation', () => {
  beforeEach(() => {
    useLlmProvidersStore.setState({
      pendingCustomSelections: { translation: null, ocr: null, clean: null },
    });
    useAioPipelineStore.setState((prev) => ({
      aioStageSelection: {
        ...prev.aioStageSelection,
        getTranslations: 'google_translate',
      },
      aioOptionsLoading: false,
      aioAbortController: null,
    }));
  });

  it('keeps the Auto sentinel selection through the fallback pass', () => {
    useAioPipelineStore.setState((prev) => ({
      aioStageSelection: {
        ...prev.aioStageSelection,
        getTranslations: TRANSLATION_AUTO_MODEL_KEY,
      },
    }));

    renderHook(() => useAioStageSelectionFallbacks(fallbackArgs([cloudOption])));

    expect(
      useAioPipelineStore.getState().aioStageSelection.getTranslations,
    ).toBe(TRANSLATION_AUTO_MODEL_KEY);
  });

  it('swaps an unpreserved selection to the first available option', () => {
    useAioPipelineStore.setState((prev) => ({
      aioStageSelection: {
        ...prev.aioStageSelection,
        getTranslations: 'nllb-200-600m-int8',
      },
    }));

    renderHook(() => useAioStageSelectionFallbacks(fallbackArgs([cloudOption])));

    expect(
      useAioPipelineStore.getState().aioStageSelection.getTranslations,
    ).toBe('google_translate');
  });
});
