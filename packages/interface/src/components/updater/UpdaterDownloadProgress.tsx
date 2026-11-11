import { useI18n } from "../../i18n";
import { useUpdaterProgress } from "../../hooks/useUpdater";
import { formatBytesI18n } from "../../utils/formatBytes";

/**
 * Shared download-progress block for both updater modals. This leaf subscribes
 * to UpdaterProgressContext itself, so download ticks re-render only this
 * block — the modals and the pages above them stay still.
 */
export const UpdaterDownloadProgress = () => {
  const { t } = useI18n();
  const progress = useUpdaterProgress();
  const formatBytes = (value: number): string => formatBytesI18n(value, t);
  const percent = Math.min(100, Math.max(0, progress.percent));

  return (
    <div className="koma-modal__progress" role="status">
      <div className="koma-modal__progress-head">
        <span className="koma-modal__progress-title">
          {t("update.modal.downloading", { percent: Math.round(percent) })}
        </span>
        <span className="koma-modal__progress-percent">{Math.round(percent)}%</span>
      </div>
      <div className="koma-progress-bar" aria-hidden="true">
        <div
          className="koma-progress-bar__fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="koma-modal__progress-meta">
        <span>{formatBytes(progress.transferred)}</span>
        <span>{formatBytes(progress.total)}</span>
      </p>
    </div>
  );
};

export default UpdaterDownloadProgress;
