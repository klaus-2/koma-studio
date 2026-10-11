import { useI18n } from "../../i18n";
import SyncPanelClassic from "./SyncPanelClassic";
import ReleaseNotesMarkdownClassic from "./ReleaseNotesMarkdownClassic";

interface UpdateModalProps {
  open: boolean;
  currentVersion: string;
  newVersion: string | null;
  releaseNotes: string | null;
  onClose: () => void;
  onOpenReleasePage: () => Promise<void>;
}

export const UpdateModalClassic = ({
  open,
  currentVersion,
  newVersion,
  releaseNotes,
  onClose,
  onOpenReleasePage,
}: UpdateModalProps) => {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="koma-modal-backdrop" onClick={onClose}>
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
          <button type="button" onClick={onClose} className="koma-modal__close" aria-label={t("update.modal.closeAria")}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

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
              <ReleaseNotesMarkdownClassic markdown={releaseNotes} className="koma-modal__markdown" />
            ) : (
              <p className="koma-modal__notes-empty">{t("update.modal.releaseNotesEmpty")}</p>
            )}
          </div>
        </div>

        {/* Sync control panel */}
        <SyncPanelClassic />

        {/* Actions */}
        <div className="koma-modal__actions">
          <button
            type="button"
            onClick={() => void onOpenReleasePage()}
            className="auth-submit auth-submit--outline"
          >
            {t("update.modal.openReleasePage")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="auth-submit auth-submit--outline"
          >
            {t("update.modal.laterAction")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateModalClassic;
