import type { ModelProgress } from "../../models/types";
import { useI18n } from "../../i18n";
import {
  formatDownloadBytes,
  formatDownloadEta,
  truncateDownloadFilename,
} from "./progressFormat";

import styles from "./styles.module.css";

export interface ModelProgressBarProps {
  progress: ModelProgress;
  onCancel?: () => void;
  compact?: boolean;
}

export const ModelProgressBarClassic = ({ progress, onCancel, compact = false }: ModelProgressBarProps) => {
  const { t } = useI18n();
  // A null percent means the backend does not know the total yet: the bar is
  // indeterminate instead of showing 0.0% of a guessed denominator.
  const percent = progress.percent === null ? null : Math.max(0, Math.min(100, progress.percent));
  const determinate = percent !== null;
  const etaLabel = determinate ? formatDownloadEta(progress.etaSeconds) : null;
  const hasFileCount =
    typeof progress.filesTotal === "number" && progress.filesTotal > 0;
  const completedCount =
    typeof progress.filesCompleted === "number" && hasFileCount
      ? Math.min(progress.filesCompleted, progress.filesTotal ?? 0)
      : 0;
  const fileLabel = progress.currentFile
    ? truncateDownloadFilename(progress.currentFile, compact ? 18 : 26)
    : null;

  return (
    <div className={compact ? styles.progressCompact : styles.progressRoot}>
      <div className={styles.progressMeta}>
        <span>
          {determinate ? `${percent.toFixed(1)}%` : t('modelManager.progress.unknownTotal')}
          {progress.phase === 'verifying' ? ` · ${t('modelManager.status.verifying')}` : ''}
          {progress.attempt > 1 ? ` · ${t('modelManager.progress.attempt', { count: progress.attempt })}` : ''}
        </span>
        <span>
          {formatDownloadBytes(progress.speedBytesPerSecond, true)}/s
          {etaLabel ? ` · ~${etaLabel}` : ''}
        </span>
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
      {(fileLabel || hasFileCount) && (
        <div className={styles.progressMeta}>
          <span title={progress.currentFile ?? undefined}>{fileLabel ?? ''}</span>
          {hasFileCount ? (
            <span>
              {t('modelManager.progress.files', {
                completed: completedCount,
                total: progress.filesTotal ?? 0,
              })}
            </span>
          ) : null}
        </div>
      )}
      <div className={styles.progressMeta}>
        <span>
          {formatDownloadBytes(progress.bytesDownloaded)}
          {progress.totalBytes === null
            ? ` · ${t('modelManager.progress.unknownTotal')}`
            : ` / ${formatDownloadBytes(progress.totalBytes)}`}
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
