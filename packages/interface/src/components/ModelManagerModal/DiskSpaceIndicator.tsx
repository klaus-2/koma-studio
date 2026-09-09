import { AlertTriangle, HardDrive } from 'lucide-react';
import { useI18n } from '../../i18n';

import { formatBytes } from '../../models/model-storage';
import type { DiskSpaceInfo } from '../../models/types';
import styles from './styles.module.css';

interface DiskSpaceIndicatorProps {
  diskSpace: DiskSpaceInfo | null;
  installedCount: number;
  totalCount: number;
  installedSizeBytes: number;
}

export const DiskSpaceIndicator = ({
  diskSpace,
  installedCount,
  totalCount,
  installedSizeBytes,
}: DiskSpaceIndicatorProps) => {
  const { t } = useI18n();
  const usagePercent = diskSpace
    ? ((diskSpace.totalBytes - diskSpace.freeBytes) / diskSpace.totalBytes) *
      100
    : 0;
  const isDanger = usagePercent > 90;
  const isWarning = usagePercent > 75 && !isDanger;
  const fillClass = isDanger
    ? styles.diskBarFillDanger
    : isWarning
      ? styles.diskBarFillWarning
      : styles.diskBarFill;

  return (
    <div className={styles.diskIndicator}>
      <div className={styles.diskLine}>
        <HardDrive size={12} />
        <span>
          {t('modelManager.disk.free', { space: diskSpace ? formatBytes(diskSpace.freeBytes) : '—' })}
          {' · '}
          {t('modelManager.disk.models', { installed: installedCount, total: totalCount, size: formatBytes(installedSizeBytes) })}
        </span>
      </div>

      {diskSpace && (
        <div className={styles.diskBar} aria-hidden="true">
          <div className={fillClass} style={{ width: `${usagePercent}%` }} />
        </div>
      )}

      {!diskSpace && (
        <div className={styles.diskWarning}>
          <AlertTriangle size={11} />
          <span>{t('modelManager.disk.notVerified')}</span>
        </div>
      )}
    </div>
  );
};

export default DiskSpaceIndicator;

