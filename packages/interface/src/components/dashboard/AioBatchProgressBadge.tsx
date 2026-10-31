import { memo } from 'react';

import { useI18n } from '../../i18n';
import {
  formatEta,
  type AioBatchProgress,
} from '@/pages/dashboard/lib/aio-batch-progress';

interface AioBatchProgressBadgeProps {
  readonly progress: AioBatchProgress;
  readonly className?: string;
}

/**
 * Chapter/stage/ETA label shared by both dashboard footers. The exact
 * chapter name is kept in the title so the visible label stays short.
 */
export default memo(function AioBatchProgressBadge({
  progress,
  className,
}: AioBatchProgressBadgeProps) {
  const { t } = useI18n();
  const eta = formatEta(progress.etaSeconds, {
    second: t('dashboard.footer.batch.unitSecond'),
    minute: t('dashboard.footer.batch.unitMinute'),
  });
  const label = [
    t('dashboard.footer.batch.chapter', {
      index: progress.chapterIndex,
      count: progress.chapterCount,
    }),
    progress.stageLabel,
    eta ? t('dashboard.footer.batch.eta', { value: eta }) : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  return (
    <span className={className} title={progress.chapterLabel}>
      {label}
    </span>
  );
});
