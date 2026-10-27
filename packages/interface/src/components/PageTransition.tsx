import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m } from "framer-motion";
import { useI18n } from "../i18n";
import brandLogo from "@koma/ui/assets/logo-1.webp";
import { EASE } from "./system/v2/kit";
import { useThemeStore } from "@koma/ui/stores/theme-store";
import { PageTransitionClassic } from "./PageTransitionClassic";

type TransitionVariant = "default" | "panels" | "minimal";
type TransitionPhase = "idle" | "entering" | "visible" | "exiting" | "done";

interface PageTransitionProps {
  active: boolean;
  variant?: TransitionVariant;
  message?: string;
  minDuration?: number;
  onExitComplete?: () => void;
}

const ENTER_DURATION = 450;
const EXIT_DURATION = 500;
const STRIPS = 5;
const SFX = ["ドン", "ザッ", "バン"] as const;

const PageTransitionNoir = ({
  active, variant = "default", message, minDuration = 600, onExitComplete,
}: PageTransitionProps) => {
  const { t } = useI18n();
  const tips = useMemo(() => [
    t("transition.tips.loading"), t("transition.tips.preparing"), t("transition.tips.opening"),
    t("transition.tips.organizing"), t("transition.tips.warming"), t("transition.tips.workflow"),
  ], [t]);

  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [tipIndex, setTipIndex] = useState(0);

  const enteredAtRef = useRef(0);
  const phaseRef = useRef<TransitionPhase>("idle");
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePhase = useCallback((next: TransitionPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const clearTimers = useCallback(() => {
    if (phaseTimeoutRef.current) { clearTimeout(phaseTimeoutRef.current); phaseTimeoutRef.current = null; }
    if (exitTimeoutRef.current) { clearTimeout(exitTimeoutRef.current); exitTimeoutRef.current = null; }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    let phaseTimer: ReturnType<typeof setTimeout> | null = null;
    let exitTimer: ReturnType<typeof setTimeout> | null = null;
    const clearOwned = () => {
      if (phaseTimer) clearTimeout(phaseTimer);
      if (exitTimer) clearTimeout(exitTimer);
      phaseTimer = null;
      exitTimer = null;
      phaseTimeoutRef.current = null;
      exitTimeoutRef.current = null;
    };

    if (active) {
      if (phaseRef.current === "idle" || phaseRef.current === "done" || phaseRef.current === "exiting") {
        clearTimers();
        updatePhase("entering");
        enteredAtRef.current = Date.now();
        phaseTimer = setTimeout(() => updatePhase("visible"), ENTER_DURATION);
        phaseTimeoutRef.current = phaseTimer;
      }
      return clearOwned;
    }
    if (phaseRef.current !== "entering" && phaseRef.current !== "visible") {
      return clearOwned;
    }
    clearTimers();
    const elapsed = Date.now() - enteredAtRef.current;
    const remaining = Math.max(0, minDuration - elapsed);
    phaseTimer = setTimeout(() => {
      updatePhase("exiting");
      exitTimer = setTimeout(() => {
        updatePhase("done");
        onExitComplete?.();
      }, EXIT_DURATION);
      exitTimeoutRef.current = exitTimer;
    }, remaining);
    phaseTimeoutRef.current = phaseTimer;
    return clearOwned;
  }, [active, clearTimers, message, minDuration, onExitComplete, updatePhase]);

  useEffect(() => {
    if (phase !== "visible" || Boolean(message)) return;
    const id = setInterval(() => setTipIndex((c) => (c + 1) % tips.length), 2200);
    return () => clearInterval(id);
  }, [message, phase, tips.length]);

  if (phase === "idle" || phase === "done") return null;

  const exiting = phase === "exiting";
  const displayedMessage = message?.trim() ? message : tips[tipIndex];

  return (
    <div className="fixed inset-0 z-[300] overflow-hidden" role="alert" aria-live="assertive"
      aria-label={t("transition.ariaLabel")}>

      <div className="absolute inset-0 flex" aria-hidden>
        {Array.from({ length: STRIPS }).map((_, i) => (
          <m.div
            key={i}
            className="halftone h-full flex-1 border-r border-paper/[0.04] bg-ink last:border-r-0"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: exiting ? 0 : 1 }}
            style={{ originY: exiting ? 1 : 0 }}
            transition={{ duration: exiting ? 0.42 : 0.38, delay: i * 0.05, ease: EASE }}
          />
        ))}
      </div>

      <m.span aria-hidden
        className="absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r from-crimson via-crimson/50 to-transparent"
        initial={{ y: "0vh" }}
        animate={{ y: exiting ? "100vh" : "0vh" }}
        transition={{ duration: 0.5, ease: EASE }}
      />

      {/* ── Katakana vertical + SFX ── */}
      <span aria-hidden className="v-text pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 select-none font-display text-3xl font-black tracking-[0.3em] text-paper/[0.05] lg:block">
        ページ切替中
      </span>
      {variant !== "minimal" && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {SFX.map((sfx, i) => (
            <m.span key={sfx}
              className="absolute select-none font-display font-black text-crimson/15"
              style={{
                fontSize: `${3 + i}rem`,
                left: `${12 + i * 30}%`,
                top: `${18 + i * 24}%`,
                rotate: `${-8 + i * 7}deg`,
              }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 0.8 : 1 }}
              transition={{ delay: 0.25 + i * 0.12, duration: 0.4, ease: EASE }}
            >
              {sfx}
            </m.span>
          ))}
        </div>
      )}

      {/* ── Centro ── */}
      <m.div
        className="absolute inset-0 flex flex-col items-center justify-center gap-5"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: exiting ? 0 : 1, y: exiting ? -12 : 0 }}
        transition={{ duration: 0.35, delay: exiting ? 0 : 0.3, ease: EASE }}
      >
        {/* Logo hanko */}
        <m.div
          className="panel-cut-sm relative flex h-20 w-20 items-center justify-center border-2 border-crimson bg-crimson/8"
          initial={{ rotate: -8, scale: 0.7 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.35 }}
        >
          <img src={brandLogo} alt="" className="h-11 w-11 object-contain" />
          <m.span aria-hidden
            className="absolute -inset-1.5 border border-crimson/40"
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            style={{ clipPath: "polygon(0 0, 30% 0, 30% 2px, 2px 2px, 2px 30%, 0 30%)" }}
          />
        </m.div>

        <p className="font-display text-xl font-black uppercase tracking-tight text-paper">
          {t("brand.name")}
          <em className="font-accent font-normal normal-case italic text-crimson">{t("brand.studioSuffix")}</em>
        </p>

        <div className="panel-cut-sm h-1.5 w-48 overflow-hidden border border-paper/10 bg-ink-2" aria-hidden>
          <m.div
            className="stripes-anim h-full w-1/3 bg-crimson bg-[repeating-linear-gradient(-45deg,rgba(7,7,12,0.3)_0_6px,transparent_6px_12px)] bg-[length:17px_17px]"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <m.p key={displayedMessage}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="font-mono text-[10px] uppercase tracking-[0.24em] text-paper/45">
          <span aria-hidden className="text-crimson">//</span> {displayedMessage}
        </m.p>
      </m.div>

      {/* ── Crop marks ── */}
      {(["left-5 top-5 border-l border-t", "right-5 top-5 border-r border-t",
        "bottom-5 left-5 border-b border-l", "bottom-5 right-5 border-b border-r"] as const).map((pos) => (
          <span key={pos} aria-hidden className={`absolute h-5 w-5 border-paper/20 ${pos}`} />
        ))}
    </div>
  );
};

export const PageTransition = (props: PageTransitionProps) => {
  const family = useThemeStore((s) => s.family);
  return family === "noir" ? <PageTransitionNoir {...props} /> : <PageTransitionClassic {...props} />;
};
