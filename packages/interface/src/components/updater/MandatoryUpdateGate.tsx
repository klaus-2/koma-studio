import { ReleaseNotesMarkdown } from "./ReleaseNotesMarkdown";
import { useUpdater } from "../../hooks/useUpdater";
import { useI18n } from "../../i18n";

import "./MandatoryUpdateGate.css";

type UpdateTranslationFn = ReturnType<typeof useI18n>["t"];

const formatBytes = (
  t: UpdateTranslationFn,
  value: number,
): string => {
  if (!Number.isFinite(value) || value <= 0) return `0 ${t("update.units.bytes")}`;
  const units = [
    t("update.units.bytes"),
    t("update.units.kilobytes"),
    t("update.units.megabytes"),
    t("update.units.gigabytes"),
  ];
  let size = value;
  let unit = units[0];
  for (let i = 0; i < units.length; i += 1) {
    unit = units[i];
    if (size < 1024 || i === units.length - 1) break;
    size /= 1024;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
};

export const MandatoryUpdateGate = () => {
  const { t } = useI18n();
  const updater = useUpdater();

  const isAvailable = updater.status === "available";
  const isDownloading = updater.status === "downloading";
  const isDownloaded = updater.status === "downloaded";
  const progressPercent = isDownloaded
    ? 100
    : Math.max(0, Math.min(100, Number(updater.progress.percent || 0)));

  return (
    <div className="koma-update-gate">
      <div className="koma-update-gate__backdrop" aria-hidden="true" />
      <div className="koma-update-gate__panel">
        <div className="koma-update-gate__badge">{t("login.warning.mandatoryUpdateTitle")}</div>
        <h1 className="koma-update-gate__title">{t("update.modal.mandatory")}</h1>
        <p className="koma-update-gate__subtitle">
          {t("login.warning.mandatoryUpdateBody", {
            version: updater.newVersion
              ? t("login.warning.versionPrefix", { version: updater.newVersion })
              : t("login.warning.latestVersion"),
          })}
        </p>

        <div className="koma-update-gate__versions">
          <span className="koma-update-gate__version">{t("update.versionPrefix", { version: updater.currentVersion })}</span>
          <span className="koma-update-gate__version koma-update-gate__version--target">
            {updater.newVersion
              ? t("update.versionPrefix", { version: updater.newVersion })
              : t("update.modal.unknownVersion")}
          </span>
        </div>

        {(isDownloading || isDownloaded) && (
          <div className="koma-update-gate__progress">
            <div className="koma-update-gate__progress-head">
              <span>
                {isDownloaded ? t("update.modal.readyProgress") : t("update.modal.downloadingProgress")}
              </span>
              <strong>{progressPercent.toFixed(0)}%</strong>
            </div>
            <div className="koma-progress-bar">
              <div
                className={`koma-progress-bar__fill ${isDownloaded ? "koma-progress-bar__fill--done" : ""}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="koma-update-gate__progress-meta">
              <span>
                {formatBytes(t, updater.progress.transferred)} / {formatBytes(t, updater.progress.total)}
              </span>
              {isDownloading ? (
                <span>{formatBytes(t, updater.progress.speed)}{t("update.units.perSecond")}</span>
              ) : (
                <span>{t("update.modal.readyToInstall")}</span>
              )}
            </div>
          </div>
        )}

        <div className="koma-update-gate__actions">
          {isAvailable && (
            <button type="button" className="auth-submit" onClick={() => void updater.downloadUpdate()}>
              {t("update.modal.downloadAction")}
            </button>
          )}
          {isDownloading && (
            <button type="button" className="auth-submit" disabled>
              <span className="auth-submit__loading">
                <span className="auth-spinner" />
                {t("update.modal.downloadingAction")}
              </span>
            </button>
          )}
          {isDownloaded && (
            <>
              <button type="button" className="auth-submit" onClick={() => void updater.installUpdate()}>
                {t("update.modal.installAction")}
              </button>
              <button type="button" className="auth-submit auth-submit--outline" onClick={() => void updater.setAutoInstall(true)}>
                {t("update.modal.installLaterAction")}
              </button>
            </>
          )}
        </div>

        {updater.releaseNotes ? (
          <div className="koma-update-gate__notes">
            <div className="koma-update-gate__notes-title">{t("update.modal.releaseNotes")}</div>
            <ReleaseNotesMarkdown markdown={updater.releaseNotes} className="koma-update-gate__notes-body" />
          </div>
        ) : null}

        {updater.error && (
          <div className="auth-alert auth-alert--error" role="alert">
            {updater.error}
          </div>
        )}
      </div>
    </div>
  );
};

export default MandatoryUpdateGate;
