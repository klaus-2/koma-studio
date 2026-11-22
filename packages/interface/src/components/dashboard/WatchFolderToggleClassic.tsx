import type { JSX } from "react";
import { FolderOpen } from "lucide-react";

import { useI18n } from "../../i18n";
import { useWatchFolder } from "../../pages/dashboard/hooks/useWatchFolder";

export const WatchFolderToggleClassic = (): JSX.Element | null => {
  const { t } = useI18n();
  const watch = useWatchFolder({ t });
  if (!watch.available) {
    return null;
  }
  return (
    <div
      data-tour="dashboard-watch-folder"
      style={{
        marginTop: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 12px",
        border: "1px dashed var(--koma-border, rgba(128, 128, 128, 0.35))",
        borderRadius: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <FolderOpen size={14} aria-hidden="true" />
        <span style={{ fontWeight: 600, fontSize: 12 }}>{t("dashboard.watchFolder.title")}</span>
        <span style={{ fontSize: 11, opacity: 0.75, marginLeft: "auto" }}>
          {watch.active ? t("dashboard.watchFolder.watching") : t("dashboard.watchFolder.idle")}
        </span>
        <div className={`koma-toggle ${watch.active ? "koma-toggle--on" : ""}`}>
          <input
            type="checkbox"
            className="koma-toggle__input"
            aria-label={t("dashboard.watchFolder.title")}
            checked={watch.active}
            disabled={watch.busy}
            onChange={() => watch.toggle()}
          />
          <span className="koma-toggle__track">
            <span className="koma-toggle__thumb" />
          </span>
        </div>
      </div>
      {watch.folderPath !== null && (
        <p style={{ margin: 0, fontSize: 11, opacity: 0.8, wordBreak: "break-all" }} aria-live="polite">
          {watch.folderPath}
        </p>
      )}
      {watch.error !== null && (
        <p style={{ margin: 0, fontSize: 11, color: "var(--koma-danger, #e5484d)" }} role="alert">
          {watch.error}
        </p>
      )}
    </div>
  );
};

export default WatchFolderToggleClassic;
