import { useCallback, useMemo } from 'react';

import {
  isInstalledLocalModel,
  isStageOptionSelectable as optionIsSelectable,
  ocrStageOptionSupportsLanguage,
} from '@/models/aioStageCatalog';
import type {
  AioStageOption,
  LocalModelEntries,
} from '@/models/aioStageCatalog';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';

export { useAioStageCatalogBuild } from '@/pages/dashboard/hooks/aio-pipeline.catalog.build';
export { useAioModelSelection } from '@/pages/dashboard/hooks/aio-pipeline.catalog.selection';

export function useAioSelectedStageModels() {
  const options = useAioPipelineStore((state) => state.aioStageOptions);
  const selection = useAioPipelineStore((state) => state.aioStageSelection);
  const sourceLanguage = useAioPipelineStore((state) => state.aioSrcLang);

  const filteredOcrStageOptions = useMemo(
    () =>
      options.recognizeText.filter((option) =>
        ocrStageOptionSupportsLanguage(option, sourceLanguage),
      ),
    [options.recognizeText, sourceLanguage],
  );

  return {
    selectedDetectModel:
      options.detectText.find(
        (option) => option.key === selection.detectText,
      ) ?? null,
    filteredOcrStageOptions,
    selectedOcrModel:
      filteredOcrStageOptions.find(
        (option) => option.key === selection.recognizeText,
      ) ?? null,
    selectedLegacyTranslationOption:
      options.getTranslations.find(
        (option) => option.key === selection.getTranslations,
      ) ?? null,
    selectedSegmentModel:
      options.segmentText.find(
        (option) => option.key === selection.segmentText,
      ) ?? null,
    selectedCleanModel:
      options.cleanImage.find(
        (option) => option.key === selection.cleanImage,
      ) ?? null,
  };
}

interface UseAioStageAvailabilityArgs {
  readonly modelManagerState: Readonly<{ entries: LocalModelEntries }>;
  readonly translationStageOptionsForSelect: readonly AioStageOption[];
  readonly ocrStageOptionsForSelect: readonly AioStageOption[];
  readonly filteredCleanerOcrStageOptions: readonly AioStageOption[];
}

export function useAioStageAvailability({
  modelManagerState,
  translationStageOptionsForSelect,
  ocrStageOptionsForSelect,
  filteredCleanerOcrStageOptions,
}: UseAioStageAvailabilityArgs) {
  const options = useAioPipelineStore((state) => state.aioStageOptions);
  const entries = modelManagerState.entries;

  const isInstalledLocalAioEntry = useCallback(
    (modelKey: string): boolean => isInstalledLocalModel(modelKey, entries),
    [entries],
  );

  const isStageOptionSelectable = useCallback(
    (option: AioStageOption | null | undefined): boolean =>
      optionIsSelectable(option, entries),
    [entries],
  );

  const availableDetectStageOptions = useMemo(
    () => options.detectText.filter(isStageOptionSelectable),
    [isStageOptionSelectable, options.detectText],
  );
  const availableSegmentStageOptions = useMemo(
    () => options.segmentText.filter(isStageOptionSelectable),
    [isStageOptionSelectable, options.segmentText],
  );
  const availableCleanStageOptions = useMemo(
    () => options.cleanImage.filter(isStageOptionSelectable),
    [isStageOptionSelectable, options.cleanImage],
  );
  const availableTranslationStageOptions = useMemo(
    () => translationStageOptionsForSelect.filter(isStageOptionSelectable),
    [isStageOptionSelectable, translationStageOptionsForSelect],
  );
  const availableOcrStageOptions = useMemo(
    () => ocrStageOptionsForSelect.filter(isStageOptionSelectable),
    [isStageOptionSelectable, ocrStageOptionsForSelect],
  );
  const cleanerAvailableOcrStageOptions = useMemo(
    () => filteredCleanerOcrStageOptions.filter(isStageOptionSelectable),
    [filteredCleanerOcrStageOptions, isStageOptionSelectable],
  );

  return {
    isInstalledLocalAioEntry,
    isStageOptionSelectable,
    availableDetectStageOptions,
    availableSegmentStageOptions,
    availableCleanStageOptions,
    availableTranslationStageOptions,
    availableOcrStageOptions,
    cleanerAvailableOcrStageOptions,
  };
}
