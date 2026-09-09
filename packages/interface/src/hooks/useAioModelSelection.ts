import { useCallback, useMemo } from 'react';

import { useI18n } from '../i18n';
import { AIO_STAGE_LABELS } from '../constants/dashboard.constants';
import type { AioStageKey, AioStageSelection } from '../types/aioModelPresets';
import type { AioStageOption } from '../models/aioStageCatalog';

interface LocalModelEntry {
  status: string;
  model: {
    id: string;
    name: string;
  };
}

interface UseAioModelSelectionArgs {
  aioStageOptions: Record<AioStageKey, AioStageOption[]>;
  ocrStageOptionsForSelect: AioStageOption[];
  filteredOcrStageOptions: AioStageOption[];
  modelEntries: Record<string, LocalModelEntry>;
  aioStageSelection: AioStageSelection;
  setAioStageSelection: React.Dispatch<React.SetStateAction<AioStageSelection>>;
  openModelManagerForStage: (
    stage: AioStageKey,
    args?: { language?: string; focusedModelId?: string | null },
  ) => void;
  setStatusMessage: (message: string) => void;
}

export function useAioModelSelection({
  aioStageOptions,
  ocrStageOptionsForSelect,
  filteredOcrStageOptions,
  modelEntries,
  aioStageSelection,
  setAioStageSelection,
  openModelManagerForStage,
  setStatusMessage,
}: UseAioModelSelectionArgs) {
  const { t } = useI18n();

  const getAioStageOption = useCallback((stage: AioStageKey, modelKey: string): AioStageOption | null => {
    if (stage === 'recognizeText') {
      return ocrStageOptionsForSelect.find((option) => option.key === modelKey)
        ?? aioStageOptions.recognizeText.find((option) => option.key === modelKey)
        ?? null;
    }

    return aioStageOptions[stage].find((option) => option.key === modelKey) ?? null;
  }, [aioStageOptions, ocrStageOptionsForSelect]);

  const formatAioStageOptionLabel = useCallback((option: AioStageOption): string => {
    const localEntry = modelEntries[option.key];
    if (!localEntry) {
      if (!option.implemented) {
        return `${option.name} (roadmap)`;
      }
      return `${option.name}${option.available ? '' : t('aioModel.label.unavailable')}`;
    }

    const installed =
      localEntry.status === 'installed' || localEntry.status === 'update_available';
    if (!installed) {
      return `${option.name} ${t('aioModel.label.notInstalled')}`;
    }

    if (localEntry.status === 'update_available') {
      return `${option.name} ${t('aioModel.label.updateAvailable')}`;
    }

    return `${option.name} ${t('aioModel.label.installed')}`;
  }, [modelEntries, t]);

  const resolveLocalModelFocusForStage = useCallback((
    stage: Exclude<AioStageKey, 'getTranslations'>,
    selectedKey: string,
  ): string | null => {
    const selectedEntry = modelEntries[selectedKey];
    if (selectedEntry) {
      return selectedEntry.model.id;
    }

    const stageOptions = stage === 'recognizeText'
      ? filteredOcrStageOptions
      : aioStageOptions[stage];
    const firstLocalOption = stageOptions.find((option) => Boolean(modelEntries[option.key]));
    if (firstLocalOption) {
      return firstLocalOption.key;
    }

    return null;
  }, [aioStageOptions, filteredOcrStageOptions, modelEntries]);

  const selectAioLocalStageModel = useCallback((
    stage: Exclude<AioStageKey, 'getTranslations'>,
    modelKey: string,
  ) => {
    const localEntry = modelEntries[modelKey];
    if (!localEntry) {
      const focusedModelId = resolveLocalModelFocusForStage(stage, modelKey);
      setStatusMessage(t('aioModel.status.selectAndInstall', { stage: AIO_STAGE_LABELS[stage] }));
      openModelManagerForStage(stage, { focusedModelId });
      return;
    }

    const installed =
      localEntry.status === 'installed' || localEntry.status === 'update_available';
    if (!installed) {
      setStatusMessage(t('aioModel.status.installBeforeUse', { name: localEntry.model.name }));
      openModelManagerForStage(stage, { focusedModelId: localEntry.model.id });
      return;
    }

    setAioStageSelection((prev) => ({ ...prev, [stage]: modelKey }));
  }, [modelEntries, openModelManagerForStage, resolveLocalModelFocusForStage, setAioStageSelection, setStatusMessage, t]);

  const selectAioRecognizeTextModel = useCallback((modelKey: string) => {
    const localEntry = modelEntries[modelKey];
    if (localEntry) {
      selectAioLocalStageModel('recognizeText', modelKey);
      return;
    }

    const option = getAioStageOption('recognizeText', modelKey);
    if (!option) {
      setStatusMessage(t('aioModel.status.selectValidOcr'));
      return;
    }

    if (!option.implemented) {
      setStatusMessage(t('aioModel.status.inRoadmap', { name: option.name }));
      return;
    }

    if (!option.available) {
      setStatusMessage(t('aioModel.status.requiresConfig', { name: option.name }));
      return;
    }

    setAioStageSelection((prev) => ({ ...prev, recognizeText: modelKey }));
  }, [
    aioStageSelection.recognizeText,
    getAioStageOption,
    modelEntries,
    openModelManagerForStage,
    resolveLocalModelFocusForStage,
    selectAioLocalStageModel,
    setAioStageSelection,
    setStatusMessage,
    t,
  ]);

  const getLocalStageStatusText = useCallback((modelKey: string): string | null => {
    const entry = modelEntries[modelKey];
    if (!entry) {
      return null;
    }

    if (entry.status === 'installed') {
      return t('aioModel.status.installedOk');
    }

    if (entry.status === 'update_available') {
      return t('aioModel.status.installedUpdate');
    }

    return entry.status;
  }, [modelEntries, t]);

  const selectedDetectStatusText = useMemo(
    () => getLocalStageStatusText(aioStageSelection.detectText),
    [aioStageSelection.detectText, getLocalStageStatusText],
  );
  const selectedOcrStatusText = useMemo(
    () => getLocalStageStatusText(aioStageSelection.recognizeText),
    [aioStageSelection.recognizeText, getLocalStageStatusText],
  );
  const selectedSegmentStatusText = useMemo(
    () => getLocalStageStatusText(aioStageSelection.segmentText),
    [aioStageSelection.segmentText, getLocalStageStatusText],
  );
  const selectedCleanStatusText = useMemo(
    () => getLocalStageStatusText(aioStageSelection.cleanImage),
    [aioStageSelection.cleanImage, getLocalStageStatusText],
  );

  return {
    getAioStageOption,
    formatAioStageOptionLabel,
    resolveLocalModelFocusForStage,
    selectAioLocalStageModel,
    selectAioRecognizeTextModel,
    getLocalStageStatusText,
    selectedDetectStatusText,
    selectedOcrStatusText,
    selectedSegmentStatusText,
    selectedCleanStatusText,
  };
}
