import { useEffect } from 'react';

import {
  isCustomModelSelectionKey,
  toCustomModelSelectionKey,
} from '../../../utils/customLlm';
import type { useAioPipelineStore } from '../stores/aio-pipeline-store';
import type { useLlmProvidersStore } from '../stores/llm-providers-store';
import type { useLlmStageProfileOptions } from './llm-providers';

type AioPipelineState = ReturnType<typeof useAioPipelineStore.getState>;
type LlmProvidersState = ReturnType<typeof useLlmProvidersStore.getState>;
type LlmStageProfileOptionsApi = ReturnType<typeof useLlmStageProfileOptions>;

export interface UseCustomSelectionReconcileArgs {
  readonly aioStageSelection: AioPipelineState['aioStageSelection'];
  readonly aioStageOptions: AioPipelineState['aioStageOptions'];
  readonly setAioStageSelection: AioPipelineState['setAioStageSelection'];
  readonly pendingCustomSelections: LlmProvidersState['pendingCustomSelections'];
  readonly markPendingCustomSelection: LlmProvidersState['markPendingCustomSelection'];
  readonly customLlmProfilesHydrated: LlmProvidersState['customLlmProfilesHydrated'];
  readonly customLlmProfilesLoading: LlmProvidersState['customLlmProfilesLoading'];
  readonly selectedCustomTranslationProfile: LlmStageProfileOptionsApi['selectedCustomTranslationProfile'];
  readonly selectedCustomOcrProfile: LlmStageProfileOptionsApi['selectedCustomOcrProfile'];
}

/**
 * Falls custom model selections back to an available stage option when the
 * selected custom profile disappears, and clears satisfied pending selections.
 */
export function useCustomSelectionReconcile({
  aioStageSelection,
  aioStageOptions,
  setAioStageSelection,
  pendingCustomSelections,
  markPendingCustomSelection,
  customLlmProfilesHydrated,
  customLlmProfilesLoading,
  selectedCustomTranslationProfile,
  selectedCustomOcrProfile,
}: UseCustomSelectionReconcileArgs): void {
  useEffect(() => {
    const selectedKey = aioStageSelection.getTranslations;
    const pendingSelection = pendingCustomSelections.translation;
    if (!isCustomModelSelectionKey(selectedKey)) {
      if (pendingSelection) {
        markPendingCustomSelection('translation', null);
      }
      return;
    }
    if (!customLlmProfilesHydrated || customLlmProfilesLoading) {
      return;
    }
    const optionStillPresent = aioStageOptions.getTranslations.some(
      (option) => option.key === selectedKey,
    );
    if (
      pendingSelection === selectedKey ||
      selectedCustomTranslationProfile ||
      optionStillPresent
    ) {
      return;
    }

    const fallbackTranslationOption = aioStageOptions.getTranslations.find(
      (option) => option.available && option.implemented,
    );
    setAioStageSelection((prev) => ({
      ...prev,
      getTranslations: fallbackTranslationOption?.key ?? '',
    }));
  }, [
    aioStageSelection.getTranslations,
    aioStageOptions.getTranslations,
    customLlmProfilesHydrated,
    customLlmProfilesLoading,
    markPendingCustomSelection,
    pendingCustomSelections.translation,
    selectedCustomTranslationProfile,
    setAioStageSelection,
  ]);

  useEffect(() => {
    const selectedKey = aioStageSelection.recognizeText;
    const pendingSelection = pendingCustomSelections.ocr;
    if (!isCustomModelSelectionKey(selectedKey)) {
      if (pendingSelection) {
        markPendingCustomSelection('ocr', null);
      }
      return;
    }
    if (!customLlmProfilesHydrated || customLlmProfilesLoading) {
      return;
    }
    const optionStillPresent = aioStageOptions.recognizeText.some(
      (option) => option.key === selectedKey,
    );
    if (
      pendingSelection === selectedKey ||
      selectedCustomOcrProfile ||
      optionStillPresent
    ) {
      return;
    }

    const fallbackOcrOption = aioStageOptions.recognizeText.find(
      (option) => option.available && option.implemented,
    );
    setAioStageSelection((prev) => ({
      ...prev,
      recognizeText: fallbackOcrOption?.key ?? '',
    }));
  }, [
    aioStageSelection.recognizeText,
    aioStageOptions.recognizeText,
    customLlmProfilesHydrated,
    customLlmProfilesLoading,
    markPendingCustomSelection,
    pendingCustomSelections.ocr,
    selectedCustomOcrProfile,
    setAioStageSelection,
  ]);

  useEffect(() => {
    const pendingSelection = pendingCustomSelections.translation;
    if (!pendingSelection) {
      return;
    }
    if (pendingSelection !== aioStageSelection.getTranslations) {
      markPendingCustomSelection('translation', null);
      return;
    }
    if (
      selectedCustomTranslationProfile &&
      toCustomModelSelectionKey(selectedCustomTranslationProfile) ===
      pendingSelection
    ) {
      markPendingCustomSelection('translation', null);
    }
  }, [
    aioStageSelection.getTranslations,
    markPendingCustomSelection,
    pendingCustomSelections.translation,
    selectedCustomTranslationProfile,
  ]);

  useEffect(() => {
    const pendingSelection = pendingCustomSelections.ocr;
    if (!pendingSelection) {
      return;
    }
    if (pendingSelection !== aioStageSelection.recognizeText) {
      markPendingCustomSelection('ocr', null);
      return;
    }
    if (
      selectedCustomOcrProfile &&
      toCustomModelSelectionKey(selectedCustomOcrProfile) === pendingSelection
    ) {
      markPendingCustomSelection('ocr', null);
    }
  }, [
    aioStageSelection.recognizeText,
    markPendingCustomSelection,
    pendingCustomSelections.ocr,
    selectedCustomOcrProfile,
  ]);
}
