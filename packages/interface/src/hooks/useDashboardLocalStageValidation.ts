import { useCallback } from 'react';

import { useI18n } from '../i18n';
import type { AioStageKey } from '../types/aioModelPresets';

interface LocalModelEntry {
  status: string;
  model: {
    id: string;
    name: string;
  };
}

interface UseDashboardLocalStageValidationArgs {
  modelEntries: Record<string, LocalModelEntry>;
  openModelManagerForStage: (
    stage: AioStageKey,
    args?: { language?: string; focusedModelId?: string | null },
  ) => void;
  resolveLocalModelFocusForStage: (stage: Exclude<AioStageKey, 'getTranslations'>, selectedKey: string) => string | null;
  setStatusMessage: (message: string) => void;
}

export function useDashboardLocalStageValidation({
  modelEntries,
  openModelManagerForStage,
  resolveLocalModelFocusForStage,
  setStatusMessage,
}: UseDashboardLocalStageValidationArgs) {
  const { t } = useI18n();

  const validateManualLocalStageModel = useCallback((
    stage: Exclude<AioStageKey, 'getTranslations'>,
    stageLabel: string,
    selectedKey: string,
  ): boolean => {
    const localEntry = modelEntries[selectedKey];
    if (!localEntry) {
      setStatusMessage(t('aioExec.selectAndInstallStage', { stageLabel }));
      const focusedModelId = resolveLocalModelFocusForStage(stage, selectedKey);
      openModelManagerForStage(stage, { focusedModelId });
      return false;
    }

    const installed =
      localEntry.status === 'installed' || localEntry.status === 'update_available';
    if (!installed) {
      setStatusMessage(t('aioExec.installBeforeStage', { name: localEntry.model.name, stageLabel }));
      openModelManagerForStage(stage, { focusedModelId: localEntry.model.id });
      return false;
    }

    return true;
  }, [modelEntries, openModelManagerForStage, resolveLocalModelFocusForStage, setStatusMessage, t]);

  return {
    validateManualLocalStageModel,
  };
}
