import { memo } from 'react';

import { useI18n } from '../../../i18n';
import { useAioBatchPauseStore } from '../stores/aio-batch-pause-store';
import { useUiShellStore } from '../stores/ui-shell-store';

interface AioBatchPauseButtonProps {
  subMode: 'auto' | 'manual';
}

export default memo(function AioBatchPauseButton({
  subMode,
}: AioBatchPauseButtonProps) {
  const { t } = useI18n();
  const processing = useUiShellStore((s) => s.processing);
  const pauseRequested = useAioBatchPauseStore((s) => s.pauseRequested);
  const isPaused = useAioBatchPauseStore((s) => s.isPaused);
  const pausePhase = useAioBatchPauseStore((s) => s.pausePhase);

  if (subMode !== 'auto' || (!processing && pausePhase === 'idle')) {
    return null;
  }

  if (isPaused) {
    return (
      <button
        type="button"
        className="koma-aio-execute__btn"
        onClick={() => useAioBatchPauseStore.getState().resume()}
      >
        {t('dashboard.aio.resume')}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="koma-aio-execute__btn"
      disabled={pauseRequested}
      title={
        pausePhase === 'draining'
          ? t('dashboard.aio.pauseFinishingChunk')
          : undefined
      }
      onClick={() => useAioBatchPauseStore.getState().requestPause()}
    >
      {pausePhase === 'draining'
        ? t('dashboard.aio.pauseFinishingChunk')
        : t('dashboard.aio.pause')}
    </button>
  );
});
