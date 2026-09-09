import type { UpdaterProgress, UpdaterStatus } from "../../types";
import { ReleaseNotesMarkdown } from "./ReleaseNotesMarkdown";
import { useI18n } from "../../i18n";

type UpdateTranslationFn = ReturnType<typeof useI18n>["t"];

interface UpdateModalProps {
  open: boolean;
  status: UpdaterStatus;
  currentVersion: string;
  newVersion: string | null;
  mandatory: boolean;
  releaseNotes: string | null;
  progress: UpdaterProgress;
  autoInstallOnQuit: boolean;
  onClose: () => void;
  onDownload: () => Promise<void>;
  onInstall: () => Promise<void>;
  onInstallLater: () => Promise<void>;
  onPostpone: () => Promise<void>;
}

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

const formatSpeed = (
  t: UpdateTranslationFn,
  bps: number,
): string => `${formatBytes(t, Math.max(0, bps))}${t("update.units.perSecond")}`;

export const UpdateModal = ({
  open,
  status,
  currentVersion,
  newVersion,
  mandatory,
  releaseNotes,
  progress,
  autoInstallOnQuit,
  onClose,
  onDownload,
  onInstall,
  onInstallLater,
  onPostpone,
}: UpdateModalProps) => {
  const { t } = useI18n();
  if (!open) return null;

  const isDownloading = status === "downloading";
  const isDownloaded = status === "downloaded";
  const isAvailable = status === "available";
  const showProgress = isDownloading || isDownloaded;
  const progressPercent = Math.max(
    0,
    Math.min(100, isDownloaded ? 100 : Number(progress.percent || 0)),
  );
  const transferredBytes = isDownloaded
    ? Math.max(progress.transferred || 0, progress.total || 0)
    : progress.transferred || 0;
  const rawTotal = Math.max(progress.total || 0, transferredBytes);

  return (
    <div className="koma-modal-backdrop" onClick={mandatory ? undefined : onClose}>
      <div className="koma-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="koma-modal__header">
          <div className="koma-modal__header-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2 className="koma-modal__title">{t("update.modal.title")}</h2>
            <p className="koma-modal__version-info">
              <span className="koma-modal__version-tag">{t("update.versionPrefix", { version: currentVersion })}</span>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ opacity: 0.3 }}>
                <path d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" />
              </svg>
              <span className="koma-modal__version-tag koma-modal__version-tag--new">
                {newVersion ? t("update.versionPrefix", { version: newVersion }) : t("update.modal.unknownVersion")}
              </span>
            </p>
          </div>
          {!mandatory && (
            <button type="button" onClick={onClose} className="koma-modal__close" aria-label={t("update.modal.closeAria")}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
              </svg>
            </button>
          )}
        </div>

        {mandatory && (
          <div className="auth-alert auth-alert--warning" role="alert" style={{ marginBottom: 16 }}>
            {t("update.modal.mandatory")}
          </div>
        )}

        {/* Release Notes */}
        <div className="koma-modal__notes">
          <div className="koma-modal__notes-header">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" style={{ opacity: 0.4 }}>
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L13.414 4A2 2 0 0114 5.414V12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{t("update.modal.releaseNotes")}</span>
          </div>
          <div className="koma-modal__notes-body">
            {releaseNotes ? (
              <ReleaseNotesMarkdown markdown={releaseNotes} className="koma-modal__markdown" />
            ) : (
              <p className="koma-modal__notes-empty">{t("update.modal.releaseNotesEmpty")}</p>
            )}
          </div>
        </div>

        {showProgress && (
          <div className="koma-modal__progress">
            <div className="koma-modal__progress-head">
              <span className="koma-modal__progress-title">
                {isDownloaded ? t("update.modal.readyProgress") : t("update.modal.downloadingProgress")}
              </span>
              <span className="koma-modal__progress-percent">{progressPercent.toFixed(1)}%</span>
            </div>
            <div className="koma-progress-bar">
              <div
                className={`koma-progress-bar__fill ${isDownloaded ? "koma-progress-bar__fill--done" : ""}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="koma-modal__progress-meta">
              <span>
                {formatBytes(t, transferredBytes)} / {formatBytes(t, rawTotal)}
              </span>
              <span>{isDownloading ? formatSpeed(t, progress.speed || 0) : t("update.modal.readyToInstall")}</span>
            </div>
            {isDownloaded && (
              <p className={`koma-modal__install-hint ${autoInstallOnQuit ? "" : "koma-modal__install-hint--warn"}`}>
                {autoInstallOnQuit
                  ? t("update.modal.installHintAuto")
                  : t("update.modal.installHintManual")}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="koma-modal__actions">
          {isAvailable && (
            <button type="button" onClick={() => void onDownload()} className="auth-submit" style={{ flex: 1 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M8 2a.75.75 0 01.75.75v7.19l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 011.06-1.06l2.22 2.22V2.75A.75.75 0 018 2z" />
                  <path d="M2.75 11.5a.75.75 0 01.75.75v1.5h9v-1.5a.75.75 0 011.5 0v1.5A1.5 1.5 0 0112.5 15h-9A1.5 1.5 0 012 13.5v-1.5a.75.75 0 01.75-.75z" />
                </svg>
                {t("update.modal.downloadAction")}
              </span>
            </button>
          )}
          {isDownloading && (
            <button type="button" disabled className="auth-submit" style={{ flex: 1, opacity: 0.6 }}>
              <span className="auth-submit__loading">
                <span className="auth-spinner" />
                {t("update.modal.downloadingAction")}
              </span>
            </button>
          )}
          {isDownloaded && (
            <>
              <button
                type="button"
                onClick={() => void onInstall()}
                className="auth-submit"
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #059669, #10b981 50%, #34d399)",
                  boxShadow: "0 16px 40px rgba(16,185,129,0.25)",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {t("update.modal.installAction")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void onInstallLater()}
                className="auth-submit auth-submit--outline"
              >
                {t("update.modal.installLaterAction")}
              </button>
            </>
          )}
          {!isDownloaded && !mandatory && (
            <button
              type="button"
              onClick={() => {
                void onPostpone();
                onClose();
              }}
              className="auth-submit auth-submit--outline"
            >
              {t("update.modal.laterAction")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
