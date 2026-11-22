import { FolderOpen } from "lucide-react";
import type { ReactElement } from "react";

import { useI18n } from "../../../i18n";
import { useWatchFolder } from "../../../pages/dashboard/hooks/useWatchFolder";
import { InkToggle } from "../../../pages/settings/noir/primitives";

export const WatchFolderToggleNoir = (): ReactElement | null => {
  const { t } = useI18n();
  const watch = useWatchFolder({ t });
  if (!watch.available) {
    return null;
  }
  return (
    <div
      data-tour="dashboard-watch-folder"
      className="panel-cut-sm mt-3 flex flex-col gap-1.5 border border-dashed border-paper/15 bg-ink-3/40 px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <FolderOpen size={13} aria-hidden="true" className="text-crimson" />
        <span className="font-display text-[11px] font-bold uppercase tracking-tight text-paper">
          {t("dashboard.watchFolder.title")}
        </span>
        <span
          className={`ml-auto font-mono text-[9px] uppercase tracking-[0.16em] ${watch.active ? "text-crimson" : "text-paper/40"}`}
        >
          {watch.active ? t("dashboard.watchFolder.watching") : t("dashboard.watchFolder.idle")}
        </span>
        <InkToggle
          checked={watch.active}
          disabled={watch.busy}
          onChange={() => watch.toggle()}
          label={t("dashboard.watchFolder.title")}
        />
      </div>
      {watch.folderPath !== null && (
        <p aria-live="polite" className="m-0 break-all font-mono text-[10px] text-paper/50">
          {watch.folderPath}
        </p>
      )}
      {watch.error !== null && (
        <p role="alert" className="m-0 font-mono text-[10px] text-crimson">
          {watch.error}
        </p>
      )}
    </div>
  );
};

export default WatchFolderToggleNoir;
