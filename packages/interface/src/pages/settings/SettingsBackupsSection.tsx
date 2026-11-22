import type { JSX } from "react";
import { Archive, CheckCircle2, AlertTriangle } from "lucide-react";

import {
  formatBackupSize,
  formatBackupTimestamp,
  useWorkspaceBackups,
  type WorkspaceBackupsTranslationFn,
} from "./useWorkspaceBackups";

interface SettingsBackupsSectionArgs {
  readonly t: WorkspaceBackupsTranslationFn;
}

export const SettingsBackupsSection = ({
  t,
}: SettingsBackupsSectionArgs): JSX.Element | null => {
  const state = useWorkspaceBackups({ t });
  if (!state.available) {
    return null;
  }
  return (
    <section className="koma-stg-section">
      <div className="koma-stg-section__head">
        <Archive size={16} className="koma-stg-section__ico" />
        <h3 className="koma-stg-section__title">{t("desktop.backups.title")}</h3>
      </div>
      <p className="koma-stg-section__desc">{t("desktop.backups.description")}</p>

      {state.loading && state.backups.length === 0 ? (
        <p className="koma-stg-section__desc">{t("common.loading")}</p>
      ) : state.backups.length === 0 ? (
        <p className="koma-stg-section__desc">{t("desktop.backups.empty")}</p>
      ) : (
        <div className="koma-stg-actions koma-stg-actions--column" style={{ flexDirection: "column", gap: 8, alignItems: "stretch" }}>
          {state.backups.map((backup) => (
            <div
              key={backup.fileName}
              className="koma-stg-item"
              style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="koma-stg-item__value koma-stg-item__value--mono" style={{ wordBreak: "break-all" }}>
                  {backup.fileName}
                </div>
                <div className="koma-stg-item__label">
                  {formatBackupTimestamp(backup.modifiedAt)} • {formatBackupSize(backup.sizeBytes)}
                </div>
              </div>
              <button
                type="button"
                className="koma-btn koma-btn--ghost koma-btn--sm"
                disabled={state.busyFileName !== null}
                onClick={() => state.requestRestore(backup.fileName)}
              >
                {t("desktop.backups.restore")}
              </button>
            </div>
          ))}
        </div>
      )}

      {state.feedback && (
        <div
          className={`koma-stg-alert ${state.feedback.type === "error" ? "koma-stg-alert--error" : "koma-stg-alert--success"}`}
          role={state.feedback.type === "error" ? "alert" : "status"}
          style={{ marginTop: 14 }}
        >
          {state.feedback.type === "error" ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
          <span>{state.feedback.message}</span>
        </div>
      )}

      {state.confirmingFileName !== null && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.55)",
            padding: 16,
          }}
        >
          <div className="koma-stg-section" style={{ maxWidth: 420, width: "100%" }}>
            <h3 className="koma-stg-section__title">{t("desktop.backups.restoreConfirmTitle")}</h3>
            <p className="koma-stg-section__desc">
              {t("desktop.backups.restoreConfirmBody", { value: state.confirmingFileName })}
            </p>
            <div className="koma-stg-actions" style={{ display: "flex", gap: 8 }}>
              <button type="button" className="koma-btn koma-btn--ghost" onClick={state.cancelRestore}>
                {t("desktop.backups.restoreConfirmCancel")}
              </button>
              <button
                type="button"
                className="koma-btn koma-btn--primary"
                disabled={state.busyFileName !== null}
                onClick={state.confirmRestore}
              >
                {t("desktop.backups.restoreConfirmAccept")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default SettingsBackupsSection;
