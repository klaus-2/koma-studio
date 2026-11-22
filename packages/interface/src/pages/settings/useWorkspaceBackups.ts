import { useCallback, useEffect, useState } from "react";

import { desktopBridge } from "@/lib/desktop-bridge";
import type { DesktopBackupEntry } from "@shared/desktop-api";
import type { useI18n } from "../../i18n";

export type WorkspaceBackupsTranslationFn = ReturnType<typeof useI18n>["t"];

export interface WorkspaceBackupFeedback {
  readonly type: "success" | "error";
  readonly message: string;
}

export interface WorkspaceBackupsState {
  readonly available: boolean;
  readonly loading: boolean;
  readonly backups: readonly DesktopBackupEntry[];
  readonly confirmingFileName: string | null;
  readonly busyFileName: string | null;
  readonly feedback: WorkspaceBackupFeedback | null;
  readonly requestRestore: (fileName: string) => void;
  readonly confirmRestore: () => void;
  readonly cancelRestore: () => void;
}

interface UseWorkspaceBackupsArgs {
  readonly t: WorkspaceBackupsTranslationFn;
}

export const formatBackupSize = (sizeBytes: number): string => {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatBackupTimestamp = (modifiedAt: string): string => {
  const parsed = new Date(modifiedAt);
  return Number.isNaN(parsed.getTime()) ? modifiedAt : parsed.toLocaleString();
};

export const useWorkspaceBackups = ({
  t,
}: UseWorkspaceBackupsArgs): WorkspaceBackupsState => {
  const bridge = desktopBridge.desktop;
  const listBackups = bridge?.workspace.listBackups;
  const restoreBackup = bridge?.workspace.restoreBackup;
  const available = listBackups !== undefined && restoreBackup !== undefined;

  const [backups, setBackups] = useState<readonly DesktopBackupEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(available);
  const [confirmingFileName, setConfirmingFileName] = useState<string | null>(null);
  const [busyFileName, setBusyFileName] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<WorkspaceBackupFeedback | null>(null);
  const [reloadTick, setReloadTick] = useState<number>(0);

  const logFailure = useCallback(
    (origin: string, error: unknown): void => {
      void bridge
        ?.sessionLog({
          level: "warn",
          source: "renderer",
          message: `${origin} failed: ${error instanceof Error ? error.message : String(error)}`,
        })
        .catch(() => undefined);
    },
    [bridge],
  );

  const refresh = useCallback((): void => {
    if (listBackups === undefined) {
      return;
    }
    setLoading(true);
    void listBackups()
      .then((result) => {
        setBackups(result.backups);
      })
      .catch((error: unknown) => {
        setBackups([]);
        setFeedback({ type: "error", message: t("desktop.backups.loadFailed") });
        logFailure("workspace.listBackups", error);
      })
      .finally(() => setLoading(false));
  }, [listBackups, logFailure, t]);

  useEffect(() => {
    refresh();
  }, [refresh, reloadTick]);

  const requestRestore = useCallback((fileName: string): void => {
    setConfirmingFileName(fileName);
  }, []);

  const cancelRestore = useCallback((): void => {
    setConfirmingFileName(null);
  }, []);

  const confirmRestore = useCallback((): void => {
    const fileName = confirmingFileName;
    if (fileName === null || restoreBackup === undefined) {
      return;
    }
    setConfirmingFileName(null);
    setBusyFileName(fileName);
    void restoreBackup({ fileName })
      .then((result) => {
        if (result.ok) {
          setFeedback({
            type: "success",
            message: t("desktop.backups.restoreSuccess", { value: fileName }),
          });
        } else {
          setFeedback({
            type: "error",
            message:
              result.error !== undefined
                ? `${t("desktop.backups.restoreFailed")}: ${result.error}`
                : t("desktop.backups.restoreFailed"),
          });
        }
      })
      .catch((error: unknown) => {
        setFeedback({ type: "error", message: t("desktop.backups.restoreFailed") });
        logFailure("workspace.restoreBackup", error);
      })
      .finally(() => {
        setBusyFileName(null);
        setReloadTick((tick) => tick + 1);
      });
  }, [confirmingFileName, logFailure, restoreBackup, t]);

  return {
    available,
    loading,
    backups,
    confirmingFileName,
    busyFileName,
    feedback,
    requestRestore,
    confirmRestore,
    cancelRestore,
  };
};
