import type { ModelProgress } from "../../models/types";
import { useI18n } from "../../i18n";

import styles from "./styles.module.css";

interface ModelProgressBarProps {
  progress: ModelProgress;
  onCancel?: () => void;
  compact?: boolean;
}

const formatBytes = (value: number, compact = false): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }

  const digits = compact
    ? current >= 100
      ? 0
      : current >= 10
        ? 1
        : 2
    : current >= 100
      ? 0
      : current >= 10
        ? 1
        : 2;
  return `${current.toFixed(digits)} ${units[index]}`;
};

export const ModelProgressBar = ({ progress, onCancel, compact = false }: ModelProgressBarProps) => {
  const { t } = useI18n();
  const percent = Math.max(0, Math.min(100, progress.percent));
  return (
    <div className={compact ? styles.progressCompact : styles.progressRoot}>
      <div className={styles.progressMeta}>
        <span>{percent.toFixed(1)}%</span>
        <span>{formatBytes(progress.speedBytesPerSecond, true)}/s</span>
      </div>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.progressMeta}>
        <span>
          {formatBytes(progress.bytesDownloaded)} / {formatBytes(progress.totalBytes)}
        </span>
        {onCancel ? (
          <button type="button" className={styles.inlineButton} onClick={onCancel}>
            {t('common.cancel')}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default ModelProgressBar;
