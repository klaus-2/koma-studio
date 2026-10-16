import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, X, Zap } from "lucide-react";
import type { DesktopMiniBackendRuntimeState } from "../../../types";
import { buildRuntimeBannerToast } from "../runtime-banner-state";
import { desktopBridge } from "@/lib/desktop-bridge";
import { StripeBar } from "../../system/v2/kit";

const RUNTIME_TOAST_DISMISS_STORAGE_KEY = "koma-runtime-toast-dismiss-v1";

const IN_PROGRESS_STATUSES = new Set<DesktopMiniBackendRuntimeState["status"]>([
  "resolving", "checking", "downloading", "verifying", "extracting",
]);

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value, i = 0;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i += 1; }
  return `${size.toFixed(size >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};
const formatSpeed = (v: number): string => `${formatBytes(Math.max(0, v))}/s`;

const formatProfileLabel = (profile: string): string => {
  switch (profile) {
    case "nvidia-cuda": return "CUDA";
    case "nvidia-cuda-legacy": return "CUDA Legacy";
    case "nvidia-tensorrt": return "TensorRT";
    case "intel-openvino": return "OpenVINO";
    case "apple-mps": return "Apple MPS";
    case "amd-rocm": return "AMD ROCm";
    case "cpu": default: return "CPU";
  }
};

const buildProgressTitle = (state: DesktopMiniBackendRuntimeState): string => {
  switch (state.status) {
    case "resolving": return "Preparing local runtime";
    case "checking": return "Checking runtime package";
    case "downloading": return `Downloading ${formatProfileLabel(state.requestedProfile)} runtime`;
    case "verifying": return "Verifying runtime package";
    case "extracting": return `Installing ${formatProfileLabel(state.requestedProfile)} runtime`;
    default: return "Preparing local runtime";
  }
};

export const RuntimeStartupToastNoir = () => {
  const [runtimeState, setRuntimeState] = useState<DesktopMiniBackendRuntimeState | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [dismissedNoticeKey, setDismissedNoticeKey] = useState<string | null>(null);
  const [showReadyNotice, setShowReadyNotice] = useState(false);
  const previousStateRef = useRef<DesktopMiniBackendRuntimeState | null>(null);


  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedValue = window.localStorage.getItem(RUNTIME_TOAST_DISMISS_STORAGE_KEY);
      if (storedValue) setDismissedNoticeKey(storedValue);
    } catch { /* restricted env */ }
  }, []);

  useEffect(() => {
    let disposed = false;
    const listener = (nextState: DesktopMiniBackendRuntimeState) => {
      if (!disposed) setRuntimeState(nextState);
    };
    void desktopBridge.desktop?.getMiniBackendRuntimeState?.().then((state) => {
      if (!disposed) setRuntimeState(state ?? null);
    }).catch(() => { if (!disposed) setRuntimeState(null); });
    desktopBridge.desktop?.onMiniBackendRuntimeState?.(listener);
    return () => { disposed = true; desktopBridge.desktop?.offMiniBackendRuntimeState?.(listener); };
  }, []);

  useEffect(() => {
    const prev = previousStateRef.current;
    if (prev && IN_PROGRESS_STATUSES.has(prev.status)
      && runtimeState?.status === "ready" && runtimeState.source === "downloaded-runtime") {
      setShowReadyNotice(true);
    }
    if (runtimeState?.status !== "ready") setShowReadyNotice(false);
    previousStateRef.current = runtimeState;
  }, [runtimeState]);

  useEffect(() => {
    if (!showReadyNotice) return;
    const timer = window.setTimeout(() => setShowReadyNotice(false), 5000);
    return () => window.clearTimeout(timer);
  }, [showReadyNotice]);

  const runtimeUpdatedAt = runtimeState?.updatedAt ?? null;
  const shouldHideForDismiss =
    dismissedAt !== null && runtimeUpdatedAt !== null && dismissedAt >= runtimeUpdatedAt;

  const progressToast = useMemo(() => {
    if (!runtimeState || !IN_PROGRESS_STATUSES.has(runtimeState.status)) return null;
    const transferred = runtimeState.progress?.transferredBytes ?? 0;
    const total = runtimeState.progress?.totalBytes ?? transferred;
    const percent = total > 0
      ? Math.max(0, Math.min(100, (transferred / total) * 100))
      : Math.max(0, Math.min(100, runtimeState.progress?.percent ?? 0));
    return {
      title: buildProgressTitle(runtimeState),
      description: runtimeState.statusMessage ?? "Preparing local runtime.",
      percent, transferred, total,
      speed: runtimeState.progress?.speedBytesPerSecond ?? 0,
      attempt: runtimeState.attempt,
      maxAttempts: runtimeState.maxAttempts,
    };
  }, [runtimeState]);

  const bannerToast = useMemo(() => {
    const banner = buildRuntimeBannerToast(runtimeState, showReadyNotice);
    if (!banner) return null;
    if (banner.title === "Runtime ready" && runtimeState) {
      return {
        ...banner,
        description: `${formatProfileLabel(runtimeState.activeProfile)} runtime installed and ready to use.`,
      };
    }
    return banner;
  }, [runtimeState, showReadyNotice]);

  const persistentDismissKey = useMemo(() => {
    if (!runtimeState) return null;
    if (runtimeState.status !== "error" && runtimeState.status !== "fallback") return null;
    return [
      runtimeState.status, runtimeState.requestedProfile, runtimeState.activeProfile,
      runtimeState.statusMessage ?? "", runtimeState.lastError ?? "",
    ].join("::");
  }, [runtimeState]);

  if (!desktopBridge.desktop || !runtimeState || shouldHideForDismiss) return null;
  if (persistentDismissKey && dismissedNoticeKey === persistentDismissKey) return null;

  /* ── Progress HUD ── */
  if (progressToast) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="glass panel-cut-sm fixed bottom-5 right-5 z-[125] w-[min(300px,calc(100vw-2rem))] border border-paper/10 p-3.5"
        role="status" aria-live="polite"
      >
        <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-azure" />
        <div className="mb-2 flex items-baseline justify-between gap-2 pr-1">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper">
            <span className="blink text-azure">●</span> {progressToast.title}
          </p>
          {progressToast.maxAttempts > 1 && (
            <span className="border border-paper/15 px-1.5 py-0.5 font-mono text-[8px] text-paper/40">
              {Math.max(1, progressToast.attempt)}/{progressToast.maxAttempts}
            </span>
          )}
        </div>

        <StripeBar percent={progressToast.percent} />

        <div className="mt-1.5 flex justify-between font-mono text-[9px] text-paper/50">
          <span className="font-bold text-azure">{progressToast.percent.toFixed(1)}%</span>
          <span>{formatBytes(progressToast.transferred)} / {formatBytes(progressToast.total)}</span>
        </div>
        <p className="mt-1 font-mono text-[9px] text-paper/40">{progressToast.description}</p>
        {progressToast.speed > 0 && (
          <p className="mt-0.5 inline-flex items-center gap-1 font-mono text-[9px] text-gold">
            <Zap size={9} fill="currentColor" /> {formatSpeed(progressToast.speed)}
          </p>
        )}
      </motion.div>
    );
  }

  if (!bannerToast) return null;

  const isError = runtimeState.status === "error";
  const tone = runtimeState.status === "ready"
    ? { bar: "bg-mint", icon: "border-mint bg-mint/10 text-mint", Icon: CheckCircle2 }
    : { bar: isError ? "bg-crimson" : "bg-gold", icon: isError ? "border-crimson bg-crimson/10 text-crimson" : "border-gold bg-gold/10 text-gold", Icon: AlertTriangle };

  /* ── Banner ── */
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24, x: 8 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, y: 12 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="glass panel-cut fixed bottom-5 right-5 z-[125] w-[min(360px,calc(100vw-2rem))] border border-paper/10 p-4"
        role={isError ? "alert" : "status"} aria-live="polite"
      >
        <span aria-hidden className={`absolute left-0 top-0 h-full w-[3px] ${tone.bar}`} />
        <button type="button" aria-label="Dismiss runtime notice"
          className="absolute right-2 top-2 p-1 text-paper/35 transition-colors hover:text-crimson"
          onClick={() => {
            if (persistentDismissKey) {
              setDismissedNoticeKey(persistentDismissKey);
              try { window.localStorage.setItem(RUNTIME_TOAST_DISMISS_STORAGE_KEY, persistentDismissKey); }
              catch { /* ignore */ }
              return;
            }
            setDismissedAt(Date.now());
          }}>
          <X size={12} />
        </button>

        <div className="flex items-start gap-3 pr-5">
          <motion.span aria-hidden
            initial={{ rotate: -10, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 16 }}
            className={`panel-cut-sm flex h-9 w-9 shrink-0 items-center justify-center border ${tone.icon}`}>
            <tone.Icon size={15} />
          </motion.span>
          <div className="min-w-0">
            <p className="kicker !text-[9px]">// RUNTIME</p>
            <h3 className="font-display text-sm font-black uppercase tracking-tight text-paper">
              {bannerToast.title}
            </h3>
            <p className="mt-0.5 font-mono text-[10px] text-paper/50">{bannerToast.description}</p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RuntimeStartupToastNoir;
