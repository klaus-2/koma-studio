import { useEffect, useState } from "react";

import type {
  DesktopBugReportDiagnostics,
  DesktopBugReportPrepareResult,
} from "@shared/desktop-api";
import { useI18n } from "../i18n";
import { desktopBridge } from "@/lib/desktop-bridge";

const emptyDiagnostics = (): DesktopBugReportDiagnostics => ({
  timestamp: new Date(0).toISOString(),
  appVersion: "",
  platform: "",
  release: "",
  arch: "",
  nodeVersion: "",
  electronVersion: "",
  chromeVersion: "",
  appPackaged: false,
  envMode: "",
  updateChannel: "",
  miniBackendRunning: false,
  miniBackendRuntimeLineCount: 0,
  authApiUrl: "",
  localApiUrl: "",
  machineProfileSchemaVersion: 1,
  machineProfile: null,
  machineProfileSync: {
    lastSyncedAt: null,
    lastChangedAt: null,
    lastError: null,
    profileHash: null,
    changedFields: [],
    lastReason: null,
  },
});

interface BugReportPrepareState {
  prep: DesktopBugReportPrepareResult | null;
  prepLoading: boolean;
}

/**
 * Prepares the bug-report evidence (screenshot + diagnostics) while the modal
 * is open. The cancelled flag drops resolutions that land after the modal was
 * closed or reopened, so a slow prepare() can never paint stale evidence into
 * a fresh session. Shared by the classic and noir modal twins — keep the race
 * guard in exactly one place.
 */
export const useBugReportPrepare = (open: boolean): BugReportPrepareState => {
  const { t } = useI18n();
  const [prep, setPrep] = useState<DesktopBugReportPrepareResult | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrepLoading(true);
    let cancelled = false;
    void (async () => {
      const api = desktopBridge.desktop?.api?.bugReport;
      if (!api) {
        if (cancelled) return;
        setPrep({
          screenshotDataUrl: null,
          autoLogs: [],
          diagnostics: emptyDiagnostics(),
          ready: false,
          error: t('bugReport.error.bridgeUnavailable'),
        });
        setPrepLoading(false);
        return;
      }
      try {
        const nextPrep = await api.prepare();
        if (!cancelled) setPrep(nextPrep);
      } catch (e) {
        if (cancelled) return;
        setPrep({
          screenshotDataUrl: null,
          autoLogs: [],
          diagnostics: emptyDiagnostics(),
          ready: false,
          error: e instanceof Error ? e.message : t('bugReport.error.prepareFailed'),
        });
      } finally {
        if (!cancelled) setPrepLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  return { prep, prepLoading };
};
