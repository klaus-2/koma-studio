import type { UseUpdaterApi } from "../../hooks/useUpdater";

// The download-progress variant is kind-only on purpose: progress VALUES move
// 10-50x/s during a download and must be read by the progress leaf through
// useUpdaterProgress(), never carried through the stable updater api.
export type UpdaterUiAction =
  | { kind: "download-progress" }
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
    case "downloading":
      return { kind: "download-progress" };
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
