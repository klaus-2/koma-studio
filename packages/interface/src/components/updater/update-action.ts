import type { UseUpdaterApi } from "../../hooks/useUpdater";

export type UpdaterUiAction =
  | { kind: "download-progress"; percent: number; transferred: number; total: number }
  | { kind: "update-now" }
  | { kind: "restart-install" }
  | { kind: "update-error"; message: string | null }
  | { kind: "release-page" }
  | { kind: "none" };

export const describeUpdaterAction = (updater: UseUpdaterApi): UpdaterUiAction => {
  if (!updater.autoInstallSupported) {
    if (updater.status === "error") {
      return { kind: "update-error", message: updater.error };
    }
    return { kind: "release-page" };
  }

  switch (updater.status) {
    case "downloading": {
      const percent = Math.min(100, Math.max(0, updater.progress.percent));
      return {
        kind: "download-progress",
        percent,
        transferred: updater.progress.transferred,
        total: updater.progress.total,
      };
    }
    case "available":
      return { kind: "update-now" };
    case "downloaded":
      return { kind: "restart-install" };
    case "error":
      return { kind: "update-error", message: updater.error };
    default:
      return { kind: "none" };
  }
};
