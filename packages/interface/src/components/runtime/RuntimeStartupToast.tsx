import { useEffect, useMemo, useRef, useState } from "react";

import type { DesktopMiniBackendRuntimeState } from "../../types";
import { buildRuntimeBannerToast } from "./runtime-banner-state";

import { desktopBridge } from "@/lib/desktop-bridge";
const RUNTIME_TOAST_DISMISS_STORAGE_KEY = "koma-runtime-toast-dismiss-v1";

const IN_PROGRESS_STATUSES = new Set<DesktopMiniBackendRuntimeState["status"]>([
  "resolving",
  "checking",
  "downloading",
  "verifying",
  "extracting",
]);

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatSpeed = (value: number): string => `${formatBytes(Math.max(0, value))}/s`;

const formatProfileLabel = (profile: string): string => {
  switch (profile) {
    case "nvidia-cuda":
      return "CUDA";
    case "nvidia-cuda-legacy":
      return "CUDA Legacy";
    case "nvidia-tensorrt":
      return "TensorRT";
    case "intel-openvino":
      return "OpenVINO";
    case "apple-mps":
      return "Apple MPS";
    case "amd-rocm":
      return "AMD ROCm";
    case "cpu":
    default:
      return "CPU";
  }
};

const buildProgressTitle = (state: DesktopMiniBackendRuntimeState): string => {
  switch (state.status) {
    case "resolving":
      return "Preparing local runtime";
    case "checking":
      return "Checking runtime package";
    case "downloading":
      return `Downloading ${formatProfileLabel(state.requestedProfile)} runtime`;
    case "verifying":
      return "Verifying runtime package";
    case "extracting":
      return `Installing ${formatProfileLabel(state.requestedProfile)} runtime`;
    default:
      return "Preparing local runtime";
  }
};

export const RuntimeStartupToast = () => {
  const [runtimeState, setRuntimeState] = useState<DesktopMiniBackendRuntimeState | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [dismissedNoticeKey, setDismissedNoticeKey] = useState<string | null>(null);
  const [showReadyNotice, setShowReadyNotice] = useState(false);
  const previousStateRef = useRef<DesktopMiniBackendRuntimeState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(RUNTIME_TOAST_DISMISS_STORAGE_KEY);
      if (storedValue) {
        setDismissedNoticeKey(storedValue);
      }
    } catch {
      // Local storage can fail in restricted environments. Ignore safely.
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    const listener = (nextState: DesktopMiniBackendRuntimeState) => {
      if (!disposed) {
        setRuntimeState(nextState);
      }
    };

    void desktopBridge.desktop?.getMiniBackendRuntimeState?.().then((state) => {
      if (!disposed) {
        setRuntimeState(state ?? null);
      }
    }).catch(() => {
      if (!disposed) {
        setRuntimeState(null);
      }
    });

    desktopBridge.desktop?.onMiniBackendRuntimeState?.(listener);
    return () => {
      disposed = true;
      desktopBridge.desktop?.offMiniBackendRuntimeState?.(listener);
    };
  }, []);

  useEffect(() => {
    const previousState = previousStateRef.current;
    if (
      previousState &&
      IN_PROGRESS_STATUSES.has(previousState.status) &&
      runtimeState?.status === "ready" &&
      runtimeState.source === "downloaded-runtime"
    ) {
      setShowReadyNotice(true);
    }

    if (runtimeState?.status !== "ready") {
      setShowReadyNotice(false);
    }

    previousStateRef.current = runtimeState;
  }, [runtimeState]);

  useEffect(() => {
    if (!showReadyNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShowReadyNotice(false);
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showReadyNotice]);

  const runtimeUpdatedAt = runtimeState?.updatedAt ?? null;
  const shouldHideForDismiss =
    dismissedAt !== null && runtimeUpdatedAt !== null && dismissedAt >= runtimeUpdatedAt;

  const progressToast = useMemo(() => {
    if (!runtimeState || !IN_PROGRESS_STATUSES.has(runtimeState.status)) {
      return null;
    }

    const transferred = runtimeState.progress?.transferredBytes ?? 0;
    const total = runtimeState.progress?.totalBytes ?? transferred;
    const percent = total > 0
      ? Math.max(0, Math.min(100, (transferred / total) * 100))
      : Math.max(0, Math.min(100, runtimeState.progress?.percent ?? 0));
    // resolving/checking are warmup phases without byte counts: a fake 0%
    // bar misleads the user — show a textual spinner instead of progress.
    const indeterminate =
      (runtimeState.status === "resolving" || runtimeState.status === "checking") &&
      total === 0;
    const description = indeterminate && !runtimeState.statusMessage
      ? "Starting local runtime — the first start may take a few minutes."
      : runtimeState.statusMessage ?? "Preparing local runtime.";

    return {
      title: buildProgressTitle(runtimeState),
      description,
      indeterminate,
      percent,
      transferred,
      total,
      speed: runtimeState.progress?.speedBytesPerSecond ?? 0,
      attempt: runtimeState.attempt,
      maxAttempts: runtimeState.maxAttempts,
    };
  }, [runtimeState]);

  const bannerToast = useMemo(() => {
    const banner = buildRuntimeBannerToast(runtimeState, showReadyNotice);
    if (!banner) {
      return null;
    }

    if (banner.title === "Runtime ready" && runtimeState) {
      return {
        ...banner,
        description: `${formatProfileLabel(runtimeState.activeProfile)} runtime installed and ready to use.`,
      };
    }

    return banner;
  }, [runtimeState, showReadyNotice]);

  const persistentDismissKey = useMemo(() => {
    if (!runtimeState) {
      return null;
    }

    if (runtimeState.status !== "error" && runtimeState.status !== "fallback") {
      return null;
    }

    return [
      runtimeState.status,
      runtimeState.requestedProfile,
      runtimeState.activeProfile,
      runtimeState.statusMessage ?? "",
      runtimeState.lastError ?? "",
    ].join("::");
  }, [runtimeState]);

  if (!desktopBridge.desktop || !runtimeState || shouldHideForDismiss) {
    return null;
  }

  if (persistentDismissKey && dismissedNoticeKey === persistentDismissKey) {
    return null;
  }

  if (progressToast) {
    return (
      <div className="koma-progress-toast" role="status" aria-live="polite">
        <div className="koma-progress-toast__header">
          <div className="koma-progress-toast__title-row">
            <span className="auth-spinner" style={{ width: 14, height: 14 }} />
            <p className="koma-progress-toast__title">{progressToast.title}</p>
          </div>
          {progressToast.maxAttempts > 1 ? (
            <span className="koma-progress-toast__version">
              Attempt {Math.max(1, progressToast.attempt)}/{progressToast.maxAttempts}
            </span>
          ) : null}
        </div>

        {progressToast.indeterminate ? (
          <div className="koma-progress-bar" aria-busy="true" />
        ) : (
          <div className="koma-progress-bar">
            <div className="koma-progress-bar__fill" style={{ width: `${progressToast.percent}%` }} />
          </div>
        )}

        {!progressToast.indeterminate && (
          <div className="koma-progress-toast__meta">
            <span>{progressToast.percent.toFixed(1)}%</span>
            <span>
              {formatBytes(progressToast.transferred)} / {formatBytes(progressToast.total)}
            </span>
          </div>
        )}

        <p className="koma-progress-toast__speed">{progressToast.description}</p>
        {progressToast.speed > 0 ? (
          <p className="koma-progress-toast__speed">{formatSpeed(progressToast.speed)}</p>
        ) : null}
      </div>
    );
  }

  if (!bannerToast) {
    return null;
  }

  return (
    <div className="koma-toast" role={runtimeState.status === "error" ? "alert" : "status"} aria-live="polite">
      <div className="koma-toast__glow" aria-hidden="true" />
      <button
        type="button"
        onClick={() => {
          if (persistentDismissKey) {
            setDismissedNoticeKey(persistentDismissKey);
            try {
              window.localStorage.setItem(RUNTIME_TOAST_DISMISS_STORAGE_KEY, persistentDismissKey);
            } catch {
              // Ignore local storage write failures.
            }
            return;
          }

          setDismissedAt(Date.now());
        }}
        className="koma-toast__close"
        aria-label="Dismiss runtime notice"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
          <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
        </svg>
      </button>

      <div className="koma-toast__icon">
        {runtimeState.status === "ready" ? (
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l6.516 11.59c.75 1.334-.213 2.99-1.742 2.99H3.483c-1.53 0-2.492-1.656-1.743-2.99L8.257 3.1zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-6a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      <div className="koma-toast__body">
        <h3 className="koma-toast__title">{bannerToast.title}</h3>
        <p className="koma-toast__desc">{bannerToast.description}</p>
      </div>
    </div>
  );
};

export default RuntimeStartupToast;
