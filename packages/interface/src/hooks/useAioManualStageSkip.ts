import { useCallback } from 'react';

import { useI18n } from '../i18n';
import {
  AIO_MANUAL_STAGE_ORDER,
  AIO_PIPELINE_STAGE_LABELS,
} from '../constants/dashboard.constants';
import { clamp } from '../utils/dashboard.utils';
import { useAioPipelineStore } from '../pages/dashboard/stores/aio-pipeline-store';

interface UseAioManualStageSkipArgs {
  activeId: string | null;
  completeManualStageForImage: (imageId: string, stageIndex: number, status: 'done' | 'skipped') => void;
  setStatusMessage: (value: string) => void;
}

export function useAioManualStageSkip({
  activeId,
  completeManualStageForImage,
  setStatusMessage,
}: UseAioManualStageSkipArgs) {
  const { t } = useI18n();

  return useCallback(() => {
    if (!activeId) {
      setStatusMessage('Select an image to skip a stage.');
      return;
    }
    // Progress read is event-time (skip runs on user action): getState at
    // call time instead of subscribing the page to the whole map.
    const progress =
      useAioPipelineStore.getState().aioManualProgressByImage[activeId];
    if (!progress) {
      setStatusMessage(t('aioManual.progressionNotInitialized'));
      return;
    }
    const stageIndex = clamp(progress.currentIndex, 0, AIO_MANUAL_STAGE_ORDER.length - 1);
    const stageLabel = AIO_PIPELINE_STAGE_LABELS[AIO_MANUAL_STAGE_ORDER[stageIndex]!];
    completeManualStageForImage(activeId, stageIndex, 'skipped');
    setStatusMessage(`Modo manual: etapa "${stageLabel}" pulada.`);
  }, [activeId, completeManualStageForImage, setStatusMessage, t]);
}
