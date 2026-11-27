import type { StageTabKey } from '@/pages/AioStageTabBar.types';
import type { AioStepToggles } from '@/pages/dashboard/stores/aio-pipeline-store.types';
import type { AioAiExecutionMode } from '@/utils/imageEditModelConfig';

export const ALL_AIO_STAGE_TAB_KEYS: ReadonlyArray<StageTabKey> = [
  'detectText',
  'recognizeText',
  'getTranslations',
  'segmentText',
  'cleanImage',
  'render',
];

export interface AioEffectiveStageState {
  readonly enabled: AioStepToggles;
  readonly disabled: AioStepToggles;
  readonly visibleStageTabs: ReadonlyArray<StageTabKey>;
}

const ALL_STAGES_DISABLED: AioStepToggles = {
  detectText: true,
  recognizeText: true,
  getTranslations: true,
  segmentText: true,
  cleanImage: true,
  render: true,
};

export function resolveAioEffectiveStageState({
  aioSteps,
  aioAiActive,
  executionMode,
  cleanViaAi,
}: {
  readonly aioSteps: AioStepToggles;
  readonly aioAiActive: boolean;
  readonly executionMode: AioAiExecutionMode;
  readonly cleanViaAi: boolean;
}): AioEffectiveStageState {
  if (!aioAiActive) {
    return {
      enabled: { ...aioSteps },
      disabled: {
        detectText: true,
        recognizeText: false,
        getTranslations: false,
        segmentText: cleanViaAi,
        cleanImage: false,
        render: false,
      },
      visibleStageTabs: ALL_AIO_STAGE_TAB_KEYS,
    };
  }

  if (executionMode === 'direct') {
    return {
      enabled: {
        detectText: false,
        recognizeText: false,
        getTranslations: false,
        segmentText: false,
        cleanImage: false,
        render: false,
      },
      disabled: ALL_STAGES_DISABLED,
      visibleStageTabs: [],
    };
  }

  if (executionMode === 'hybrid_guided') {
    return {
      enabled: {
        detectText: true,
        recognizeText: false,
        getTranslations: false,
        segmentText: false,
        cleanImage: false,
        render: false,
      },
      disabled: ALL_STAGES_DISABLED,
      visibleStageTabs: ['detectText'],
    };
  }

  return {
    enabled: {
      detectText: true,
      recognizeText: true,
      getTranslations: true,
      segmentText: false,
      cleanImage: false,
      render: false,
    },
    disabled: ALL_STAGES_DISABLED,
    visibleStageTabs: ['detectText', 'recognizeText', 'getTranslations'],
  };
}
