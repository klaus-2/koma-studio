import { Archive, History } from "lucide-react";
import type { ReactElement } from "react";

import {
  formatBackupSize,
  formatBackupTimestamp,
  useWorkspaceBackups,
  type WorkspaceBackupsTranslationFn,
} from "../useWorkspaceBackups";
import { Sec, Alert, btnGhost, btnPrimary } from "./primitives";

interface SettingsBackupsSectionNoirArgs {
  readonly t: WorkspaceBackupsTranslationFn;
}

export const SettingsBackupsSectionNoir = ({
  t,
}: SettingsBackupsSectionNoirArgs): ReactElement | null => {
  const state = useWorkspaceBackups({ t });
  if (!state.available) {
    return null;
  }
  return (
    <Sec
      icon={<Archive size={14} />}
      title={t("desktop.backups.title")}
      desc={t("desktop.backups.description")}
    >
      {state.loading && state.backups.length === 0 ? (
        <p className="font-mono text-[10px] uppercase tracking-wider text-paper/40">{t("common.loading")}</p>
      ) : state.backups.length === 0 ? (
        <p className="font-mono text-[10px] uppercase tracking-wider text-paper/40">{t("desktop.backups.empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {state.backups.map((backup) => (
            <div
              key={backup.fileName}
              className="panel-cut-sm flex flex-wrap items-center justify-between gap-3 border border-paper/8 bg-ink/50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-[11px] text-paper">{backup.fileName}</p>
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-paper/40">
                  {formatBackupTimestamp(backup.modifiedAt)} • {formatBackupSize(backup.sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                className={btnGhost}
                disabled={state.busyFileName !== null}
                onClick={() => state.requestRestore(backup.fileName)}
              >
                <History size={11} /> {t("desktop.backups.restore")}
              </button>
            </div>
          ))}
        </div>
      )}

      {state.feedback && (
        <div style={{ marginTop: 14 }}>
          <Alert tone={state.feedback.type}>{state.feedback.message}</Alert>
        </div>
      )}

      {state.confirmingFileName !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-80 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="glass panel-cut-sm w-full max-w-md border border-paper/10 p-5">
            <h3 className="font-display text-sm font-black uppercase tracking-tight text-paper">
              {t("desktop.backups.restoreConfirmTitle")}
            </h3>
            <p className="mt-2 break-all font-mono text-[10px] uppercase tracking-wider text-paper/50">
              {t("desktop.backups.restoreConfirmBody", { value: state.confirmingFileName })}
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" className={btnGhost} onClick={state.cancelRestore}>
                {t("desktop.backups.restoreConfirmCancel")}
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={state.busyFileName !== null}
                onClick={state.confirmRestore}
              >
                {t("desktop.backups.restoreConfirmAccept")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Sec>
  );
};

export default SettingsBackupsSectionNoir;
