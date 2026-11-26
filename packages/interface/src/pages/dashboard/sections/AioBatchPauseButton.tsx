import { memo } from 'react';

import { useI18n } from '../../../i18n';
import type { SubMode } from '../../../types/dashboard.types';
import { useAioBatchPauseStore } from '../stores/aio-batch-pause-store';
import { useUiShellStore } from '../stores/ui-shell-store';

interface AioBatchPauseButtonProps {
  subMode: SubMode;
}

export default memo(function AioBatchPauseButton({
  subMode,
}: AioBatchPauseButtonProps) {
  const { t } = useI18n();
  const processing = useUiShellStore((s) => s.processing);
  const pauseRequested = useAioBatchPauseStore((s) => s.pauseRequested);
  const isPaused = useAioBatchPauseStore((s) => s.isPaused);
  const pausePhase = useAioBatchPauseStore((s) => s.pausePhase);

  if ((subMode !== 'auto' && subMode !== 'ai') || (!processing && pausePhase === 'idle')) {
    return null;
  }

  if (isPaused) {
    return (
      <button
        type="button"
        className="koma-aio-execute__btn koma-aio-execute__btn--pause"
        onClick={() => useAioBatchPauseStore.getState().resume()}
      >
        <span className="koma-aio-execute__pauseText">
          {t('dashboard.aio.resume')}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="koma-aio-execute__btn koma-aio-execute__btn--pause"
      disabled={pauseRequested}
      title={
        pausePhase === 'draining'
          ? t('dashboard.aio.pauseFinishingChunk')
          : undefined
      }
      onClick={() => useAioBatchPauseStore.getState().requestPause()}
    >
      <span className="koma-aio-execute__pauseText">
        {pausePhase === 'draining'
          ? t('dashboard.aio.pauseFinishingChunk')
          : t('dashboard.aio.pause')}
      </span>
    </button>
  );
});
