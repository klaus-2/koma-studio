import { useCallback } from 'react';

import { AIO_STAGE_LABELS } from '@/constants/dashboard.constants';
import { useI18n } from '@/i18n';
import {
  isInstalledLocalModel,
  isStageOptionSelectable,
  ocrStageOptionSupportsLanguage,
} from '@/models/aioStageCatalog';
import type {
  AioStageOption,
  LocalModelEntries,
} from '@/models/aioStageCatalog';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import type { AioStageKey } from '@/types/aioModelPresets';

type LocalStageKey = Exclude<AioStageKey, 'getTranslations'>;

interface UseAioModelSelectionArgs {
  readonly ocrStageOptionsForSelect: readonly AioStageOption[];
  readonly filteredOcrStageOptions: readonly AioStageOption[];
  readonly modelEntries: LocalModelEntries;
  readonly openModelManagerForStage: (
    stage: AioStageKey,
    args?: { language?: string; focusedModelId?: string | null },
  ) => void;
  readonly setStatusMessage: (message: string) => void;
}

export function useAioModelSelection({
  ocrStageOptionsForSelect,
  filteredOcrStageOptions,
  modelEntries,
  openModelManagerForStage,
  setStatusMessage,
}: UseAioModelSelectionArgs) {
  const { t } = useI18n();
  const options = useAioPipelineStore((state) => state.aioStageOptions);
  const selection = useAioPipelineStore((state) => state.aioStageSelection);

  const getAioStageOption = useCallback(
    (stage: AioStageKey, modelKey: string): AioStageOption | null => {
      if (stage === 'recognizeText') {
        return (
          ocrStageOptionsForSelect.find((option) => option.key === modelKey) ??
          options.recognizeText.find((option) => option.key === modelKey) ??
          null
        );
      }

      return options[stage].find((option) => option.key === modelKey) ?? null;
    },
    [ocrStageOptionsForSelect, options],
  );

  const formatAioStageOptionLabel = useCallback(
    (option: AioStageOption): string => {
      if (!option.implemented) return `${option.name} (roadmap)`;

      const localEntry = modelEntries[option.key];
      if (!localEntry) {
        return `${option.name}${option.available ? '' : t('aioModel.label.unavailable')
          }`;
      }

      const label = !isInstalledLocalModel(option.key, modelEntries)
        ? t('aioModel.label.notInstalled')
        : localEntry.status === 'update_available'
          ? t('aioModel.label.updateAvailable')
          : t('aioModel.label.installed');

      return `${option.name} ${label}`;
    },
    [modelEntries, t],
  );

  const resolveLocalModelFocusForStage = useCallback(
    (stage: LocalStageKey, selectedKey: string): string | null => {
      const stageOptions =
        stage === 'recognizeText'
          ? filteredOcrStageOptions
          : options[stage];

      const selectedOption = stageOptions.find(
        (option) => option.key === selectedKey,
      );
      const selectedEntry = selectedOption
        ? modelEntries[selectedOption.key]
        : undefined;

      if (selectedEntry) return selectedEntry.model.id;

      for (const option of stageOptions) {
        const entry = modelEntries[option.key];
        if (entry) return entry.model.id;
      }

      return null;
    },
    [filteredOcrStageOptions, modelEntries, options],
  );

  const commitSelection = useCallback(
    (stage: AioStageKey, modelKey: string): void => {
      useAioPipelineStore.setState((state) =>
        state.aioStageSelection[stage] === modelKey
          ? state
          : {
            aioStageSelection: {
              ...state.aioStageSelection,
              [stage]: modelKey,
            },
          },
      );
    },
    [],
  );

  const selectAioLocalStageModel = useCallback(
    (stage: LocalStageKey, modelKey: string): void => {
      const option = getAioStageOption(stage, modelKey);
      const entry = modelEntries[modelKey];
      const sourceLanguage = useAioPipelineStore.getState().aioSrcLang;

      if (
        stage === 'recognizeText' &&
        option &&
        !ocrStageOptionSupportsLanguage(option, sourceLanguage)
      ) {
        setStatusMessage(t('aioModel.status.selectValidOcr'));
        return;
      }

      if (!option || !entry) {
        setStatusMessage(
          t('aioModel.status.selectAndInstall', {
            stage: AIO_STAGE_LABELS[stage],
          }),
        );
        openModelManagerForStage(stage, {
          focusedModelId: resolveLocalModelFocusForStage(stage, modelKey),
        });
        return;
      }

      if (!option.implemented) {
        setStatusMessage(
          t('aioModel.status.inRoadmap', { name: option.name }),
        );
        return;
      }

      if (!isInstalledLocalModel(modelKey, modelEntries)) {
        setStatusMessage(
          t('aioModel.status.installBeforeUse', { name: entry.model.name }),
        );
        openModelManagerForStage(stage, {
          focusedModelId: entry.model.id,
        });
        return;
      }

      commitSelection(stage, modelKey);
    },
    [
      commitSelection,
      getAioStageOption,
      modelEntries,
      openModelManagerForStage,
      resolveLocalModelFocusForStage,
      setStatusMessage,
      t,
    ],
  );

  const selectAioRecognizeTextModel = useCallback(
    (modelKey: string): void => {
      const option = getAioStageOption('recognizeText', modelKey);
      const sourceLanguage = useAioPipelineStore.getState().aioSrcLang;

      if (
        !option ||
        !ocrStageOptionSupportsLanguage(option, sourceLanguage) ||
        modelKey === 'custom' ||
        modelKey === 'custom_ocr'
      ) {
        setStatusMessage(t('aioModel.status.selectValidOcr'));
        return;
      }

      if (modelEntries[modelKey]) {
        selectAioLocalStageModel('recognizeText', modelKey);
        return;
      }

      if (!option.implemented) {
        setStatusMessage(
          t('aioModel.status.inRoadmap', { name: option.name }),
        );
        return;
      }

      if (!isStageOptionSelectable(option, modelEntries)) {
        setStatusMessage(
          t('aioModel.status.requiresConfig', { name: option.name }),
        );
        return;
      }

      commitSelection('recognizeText', modelKey);
    },
    [
      commitSelection,
      getAioStageOption,
      modelEntries,
      selectAioLocalStageModel,
      setStatusMessage,
      t,
    ],
  );

  const getLocalStageStatusText = useCallback(
    (modelKey: string): string | null => {
      const entry = modelEntries[modelKey];
      if (!entry) return null;

      if (entry.status === 'installed') {
        return t('aioModel.status.installedOk');
      }

      if (entry.status === 'update_available') {
        return t('aioModel.status.installedUpdate');
      }

      return entry.status;
    },
    [modelEntries, t],
  );

  return {
    getAioStageOption,
    formatAioStageOptionLabel,
    resolveLocalModelFocusForStage,
    selectAioLocalStageModel,
    selectAioRecognizeTextModel,
    getLocalStageStatusText,
    selectedDetectStatusText: getLocalStageStatusText(selection.detectText),
    selectedOcrStatusText: getLocalStageStatusText(selection.recognizeText),
    selectedSegmentStatusText: getLocalStageStatusText(selection.segmentText),
    selectedCleanStatusText: getLocalStageStatusText(selection.cleanImage),
  };
}
