import { useCallback } from 'react';

import { useI18n } from '../i18n';
import {
  AIO_MANUAL_STAGE_ORDER,
  AIO_PIPELINE_STAGE_LABELS,
} from '../constants/dashboard.constants';
import { clamp } from '../utils/dashboard.utils';
import type { AioManualImageProgress } from '../types/dashboard.types';

interface UseAioManualStageSkipArgs {
  activeId: string | null;
  aioManualProgressByImage: Record<string, AioManualImageProgress>;
  completeManualStageForImage: (imageId: string, stageIndex: number, status: 'done' | 'skipped') => void;
  setStatusMessage: (value: string) => void;
}

export function useAioManualStageSkip({
  activeId,
  aioManualProgressByImage,
  completeManualStageForImage,
  setStatusMessage,
}: UseAioManualStageSkipArgs) {
  const { t } = useI18n();

  return useCallback(() => {
    if (!activeId) {
      setStatusMessage('Select an image to skip a stage.');
      return;
    }
    const progress = aioManualProgressByImage[activeId];
    if (!progress) {
      setStatusMessage(t('aioManual.progressionNotInitialized'));
      return;
    }
    const stageIndex = clamp(progress.currentIndex, 0, AIO_MANUAL_STAGE_ORDER.length - 1);
    const stageLabel = AIO_PIPELINE_STAGE_LABELS[AIO_MANUAL_STAGE_ORDER[stageIndex]!];
    completeManualStageForImage(activeId, stageIndex, 'skipped');
    setStatusMessage(`Modo manual: etapa "${stageLabel}" pulada.`);
  }, [activeId, aioManualProgressByImage, completeManualStageForImage, setStatusMessage, t]);
}
