import { memo } from 'react';

import { useI18n } from '../../i18n';
import { useAioBatchPauseStore } from '../../pages/dashboard/stores/aio-batch-pause-store';

interface AioBatchPausedBadgeProps {
  className?: string;
}

export default memo(function AioBatchPausedBadge({
  className,
}: AioBatchPausedBadgeProps) {
  const { t } = useI18n();
  const isPaused = useAioBatchPauseStore((s) => s.isPaused);

  if (!isPaused) {
    return null;
  }

  return <span className={className}>{t('dashboard.footer.batch.paused')}</span>;
});
