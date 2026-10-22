import type { ModelProgress } from "../../models/types";
import { useI18n } from "../../i18n";

import styles from "./styles.module.css";

export interface ModelProgressBarProps {
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

export const ModelProgressBarClassic = ({ progress, onCancel, compact = false }: ModelProgressBarProps) => {
  const { t } = useI18n();
  // A null percent means the backend does not know the total yet: the bar is
  // indeterminate instead of showing 0.0% of a guessed denominator.
  const percent = progress.percent === null ? null : Math.max(0, Math.min(100, progress.percent));
  const determinate = percent !== null;
  return (
    <div className={compact ? styles.progressCompact : styles.progressRoot}>
      <div className={styles.progressMeta}>
        <span>{determinate ? `${percent.toFixed(1)}%` : t('modelManager.progress.unknownTotal')}</span>
        <span>{formatBytes(progress.speedBytesPerSecond, true)}/s</span>
      </div>
      <div
        className={styles.progressBar}
        role="progressbar"
        aria-valuenow={determinate ? Math.round(percent) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={determinate ? undefined : t('modelManager.progress.unknownTotal')}
      >
        <div
          className={styles.progressFill}
          style={{ width: `${determinate ? percent : 100}%`, opacity: determinate ? 1 : 0.4 }}
        />
      </div>
      <div className={styles.progressMeta}>
        <span>
          {formatBytes(progress.bytesDownloaded)}
          {progress.totalBytes === null
            ? ` · ${t('modelManager.progress.unknownTotal')}`
            : ` / ${formatBytes(progress.totalBytes)}`}
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

export default ModelProgressBarClassic;
