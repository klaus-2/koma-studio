import { memo } from 'react';
import { Zap } from 'lucide-react';

import { useI18n } from '../../../i18n';
import { AioSection } from '../../AioSection';
import type { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { AioChecklistOption } from './AioRightPanel.skin';

type AioPipelineState = ReturnType<typeof useAioPipelineStore.getState>;

interface AioRightPanelGpuSectionProps {
  noir: boolean;
  aioGpuStages: AioPipelineState['aioGpuStages'];
  aioHasGpuExecutionProfile: boolean;
  updateAioGpuStage: AioPipelineState['updateAioGpuStage'];
}

const AioRightPanelGpuSectionBase = ({
  noir,
  aioGpuStages,
  aioHasGpuExecutionProfile,
  updateAioGpuStage,
}: AioRightPanelGpuSectionProps) => {
  const { t } = useI18n();

  return (
    <AioSection
      icon={Zap}
      title={t('dashboard.aio.gpuStages.title')}
      defaultOpen={false}
    >
      <p className="koma-aio-hint">
        {t('dashboard.aio.gpuStages.hint')}
      </p>
      {!aioHasGpuExecutionProfile && (
        <p className="koma-aio-hint">
          {t('dashboard.aio.gpuStages.noActiveProfile')}
        </p>
      )}
      <div className="koma-aio-llm-toggles">
        <AioChecklistOption
          noir={noir}
          checked={aioGpuStages.detectText}
          disabled={!aioHasGpuExecutionProfile}
          label={t('dashboard.aio.gpuStages.detect')}
          onChange={(checked) => updateAioGpuStage('detectText', checked)}
        />
        <AioChecklistOption
          noir={noir}
          checked={aioGpuStages.recognizeText}
          disabled={!aioHasGpuExecutionProfile}
          label={t('dashboard.aio.gpuStages.ocr')}
          onChange={(checked) => updateAioGpuStage('recognizeText', checked)}
        />
        <AioChecklistOption
          noir={noir}
          checked={aioGpuStages.segmentText}
          disabled={!aioHasGpuExecutionProfile}
          label={t('dashboard.aio.gpuStages.segment')}
          onChange={(checked) => updateAioGpuStage('segmentText', checked)}
        />
        <AioChecklistOption
          noir={noir}
          checked={aioGpuStages.cleanImage}
          disabled={!aioHasGpuExecutionProfile}
          label={t('dashboard.aio.gpuStages.clean')}
          onChange={(checked) => updateAioGpuStage('cleanImage', checked)}
        />
      </div>
    </AioSection>
  );
};

export const AioRightPanelGpuSection = memo(AioRightPanelGpuSectionBase);
