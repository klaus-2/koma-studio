import { useCallback, useEffect, useRef, useState } from "react";

import { desktopBridge } from "@/lib/desktop-bridge";
import type { IDesktopBridge } from "@shared/desktop-api";
import { dispatchForwardedFilePaths } from "../lib/forwarded-files";
import type { useI18n } from "../../../i18n";

const WATCH_PICK_DIALOG_CHANNEL = "plugin:dialog|open";

type WatchFolderTranslationFn = ReturnType<typeof useI18n>["t"];

export interface WatchFolderState {
  readonly available: boolean;
  readonly active: boolean;
  readonly folderPath: string | null;
  readonly error: string | null;
  readonly busy: boolean;
  readonly toggle: () => void;
}

interface UseWatchFolderArgs {
  readonly t: WatchFolderTranslationFn;
}

const resolvePickedFolder = (picked: string | string[] | null): string | null => {
  if (typeof picked === "string") {
    return picked.trim().length > 0 ? picked.trim() : null;
  }
  if (Array.isArray(picked)) {
    const first = picked[0];
    return typeof first === "string" && first.trim().length > 0 ? first.trim() : null;
  }
  return null;
};

export const useWatchFolder = ({ t }: UseWatchFolderArgs): WatchFolderState => {
  const bridge = desktopBridge.desktop;
  const watch = bridge?.watch;
  const onWatchFile = bridge?.onWatchFile;
  const available = watch !== undefined && onWatchFile !== undefined;

  const [active, setActive] = useState<boolean>(false);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const activeRef = useRef<boolean>(false);
  const watchRef = useRef<IDesktopBridge["watch"] | null>(null);

  const logFailure = useCallback(
    (origin: string, errorValue: unknown): void => {
      void bridge
        ?.sessionLog({
          level: "warn",
          source: "renderer",
          message: `${origin}: ${errorValue instanceof Error ? errorValue.message : String(errorValue)}`,
        })
        .catch(() => undefined);
    },
    [bridge],
  );

  useEffect(() => {
    if (!available || !onWatchFile) {
      return undefined;
    }
    const unlisten = onWatchFile((payload) => {
      if (activeRef.current) {
        dispatchForwardedFilePaths([payload.filePath]);
      }
    });
    return () => {
      if (typeof unlisten === "function") {
        unlisten();
      }
    };
  }, [available, onWatchFile]);

  useEffect(() => {
    return () => {
      if (activeRef.current) {
        activeRef.current = false;
        void watchRef.current?.stop().catch(() => undefined);
        watchRef.current = null;
      }
    };
  }, []);

  const toggle = useCallback((): void => {
    void (async () => {
      const currentWatch = desktopBridge.desktop?.watch ?? watchRef.current;
      if (!currentWatch) {
        return;
      }
      setError(null);
      if (activeRef.current) {
        activeRef.current = false;
        watchRef.current = null;
        setBusy(true);
        try {
          await currentWatch.stop();
        } catch (errorValue) {
          logFailure("watch.stop failed", errorValue);
        } finally {
          setBusy(false);
        }
        setActive(false);
        setFolderPath(null);
        return;
      }
      setBusy(true);
      try {
        const picked = await desktopBridge.invokeCommand<string | string[] | null>(
          WATCH_PICK_DIALOG_CHANNEL,
          {
            options: {
              directory: true,
              multiple: false,
              title: t("dashboard.watchFolder.pickTitle"),
            },
          },
        );
        const pickedFolder = resolvePickedFolder(picked);
        if (!pickedFolder) {
          return;
        }
        const result = await currentWatch.start({ folderPath: pickedFolder });
        if (result.watching) {
          activeRef.current = true;
          watchRef.current = currentWatch;
          setActive(true);
          setFolderPath(pickedFolder);
        } else {
          setError(result.error ?? t("dashboard.watchFolder.startFailed"));
        }
      } catch (errorValue) {
        setError(t("dashboard.watchFolder.startFailed"));
        logFailure("watch.start failed", errorValue);
      } finally {
        setBusy(false);
      }
    })();
  }, [logFailure, t]);

  return {
    available,
    active,
    folderPath,
    error,
    busy,
    toggle,
  };
};
