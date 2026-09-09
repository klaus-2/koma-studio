import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "../i18n";
import brandLogo from "@koma/ui/assets/logo-1.webp";

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
const FLOATING_PANELS = [
  { cls: "koma-transition__panel--1", gradient: "linear-gradient(150deg, #1a0533, #7c3aed)" },
  { cls: "koma-transition__panel--2", gradient: "linear-gradient(150deg, #042f2e, #06b6d4)" },
  { cls: "koma-transition__panel--3", gradient: "linear-gradient(150deg, #3b0028, #ec4899)" },
  { cls: "koma-transition__panel--4", gradient: "linear-gradient(150deg, #431407, #ea580c)" },
  { cls: "koma-transition__panel--5", gradient: "linear-gradient(150deg, #022c22, #10b981)" },
] as const;

interface SpeedlineSpec {
  angle: string;
  delay: string;
  length: string;
  opacity: string;
}

interface ParticleSpec {
  x: string;
  y: string;
  delay: string;
  duration: string;
  size: string;
  color: string;
}

const buildSpeedlineSpecs = (): SpeedlineSpec[] =>
  Array.from({ length: 24 }, (_, index) => ({
    angle: `${index * 15}deg`,
    delay: `${index * 0.03}s`,
    length: `${55 + Math.random() * 35}%`,
    opacity: `${0.03 + Math.random() * 0.08}`,
  }));

const buildParticleSpecs = (): ParticleSpec[] =>
  Array.from({ length: 18 }, (_, index) => ({
    x: `${10 + Math.random() * 80}%`,
    y: `${10 + Math.random() * 80}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 3}s`,
    size: `${2 + Math.random() * 4}px`,
    color:
      index % 3 === 0
        ? "var(--ua-purple, #a855f7)"
        : index % 3 === 1
          ? "var(--ua-cyan, #06b6d4)"
          : "var(--ua-rose, #f43f5e)",
  }));

const BrandMark = () => (
  <img src={brandLogo} alt="" />
);

const SpeedLines = ({ specs }: { specs: SpeedlineSpec[] }) => (
  <div className="koma-transition__speedlines" aria-hidden="true">
    {specs.map((line, index) => (
      <div
        key={index}
        className="koma-transition__speedline"
        style={
          {
            "--line-angle": line.angle,
            "--line-delay": line.delay,
            "--line-length": line.length,
            "--line-opacity": line.opacity,
          } as CSSProperties
        }
      />
    ))}
  </div>
);

const FloatingPanels = () => (
  <div className="koma-transition__panels" aria-hidden="true">
    {FLOATING_PANELS.map((panel, index) => (
      <div
        key={panel.cls}
        className={`koma-transition__panel ${panel.cls}`}
        style={
          {
            background: panel.gradient,
            "--panel-delay": `${index * 0.08}s`,
          } as CSSProperties
        }
      >
        <div className="koma-transition__panel-lines">
          <span />
          <span />
          <span />
        </div>
      </div>
    ))}
  </div>
);

const Particles = ({ specs }: { specs: ParticleSpec[] }) => (
  <div className="koma-transition__particles" aria-hidden="true">
    {specs.map((particle, index) => (
      <div
        key={index}
        className="koma-transition__particle"
        style={
          {
            "--p-x": particle.x,
            "--p-y": particle.y,
            "--p-delay": particle.delay,
            "--p-duration": particle.duration,
            "--p-size": particle.size,
            "--p-color": particle.color,
          } as CSSProperties
        }
      />
    ))}
  </div>
);

export const PageTransition = ({
  active,
  variant = "default",
  message,
  minDuration = 600,
  onExitComplete,
}: PageTransitionProps) => {
  const { t } = useI18n();
  const tips = useMemo(
    () => [
      t("transition.tips.loading"),
      t("transition.tips.preparing"),
      t("transition.tips.opening"),
      t("transition.tips.organizing"),
      t("transition.tips.warming"),
      t("transition.tips.workflow"),
    ],
    [t],
  );
  const speedlineSpecs = useMemo(buildSpeedlineSpecs, []);
  const particleSpecs = useMemo(buildParticleSpecs, []);

  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [tipIndex, setTipIndex] = useState(0);

  const enteredAtRef = useRef(0);
  const phaseRef = useRef<TransitionPhase>("idle");
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePhase = useCallback((nextPhase: TransitionPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const clearTimers = useCallback(() => {
    if (phaseTimeoutRef.current) {
      clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }

    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearTimers();
    },
    [clearTimers],
  );

  useEffect(() => {
    if (active) {
      if (
        phaseRef.current === "idle" ||
        phaseRef.current === "done" ||
        phaseRef.current === "exiting"
      ) {
        clearTimers();
        updatePhase("entering");
        enteredAtRef.current = Date.now();

        phaseTimeoutRef.current = setTimeout(() => {
          updatePhase("visible");
        }, ENTER_DURATION);
      }

      return;
    }

    if (phaseRef.current !== "entering" && phaseRef.current !== "visible") {
      return;
    }

    clearTimers();
    const elapsed = Date.now() - enteredAtRef.current;
    const remaining = Math.max(0, minDuration - elapsed);

    phaseTimeoutRef.current = setTimeout(() => {
      updatePhase("exiting");
      exitTimeoutRef.current = setTimeout(() => {
        updatePhase("done");
        onExitComplete?.();
      }, EXIT_DURATION);
    }, remaining);
  }, [active, clearTimers, message, minDuration, onExitComplete, updatePhase]);

  useEffect(() => {
    if (phase !== "visible" || Boolean(message)) {
      return;
    }

    const intervalId = setInterval(() => {
      setTipIndex((current) => (current + 1) % tips.length);
    }, 2200);

    return () => clearInterval(intervalId);
  }, [message, phase, tips.length]);

  if (phase === "idle" || phase === "done") {
    return null;
  }

  const stateClass = `koma-transition koma-transition--${variant} koma-transition--${phase}`;
  const displayedMessage = message?.trim() ? message : tips[tipIndex];

  return (
    <div className={stateClass} role="alert" aria-live="assertive" aria-label={t("transition.ariaLabel")}>
      <div className="koma-transition__backdrop" />

      <div className="koma-transition__orb koma-transition__orb--purple" aria-hidden="true" />
      <div className="koma-transition__orb koma-transition__orb--cyan" aria-hidden="true" />

      {variant !== "minimal" && <SpeedLines specs={speedlineSpecs} />}
      {variant === "panels" && <FloatingPanels />}

      <Particles specs={particleSpecs} />

      <div className="koma-transition__center">
        <div className="koma-transition__logo">
          <div className="koma-transition__logoRing">
            <svg className="koma-transition__logoRingSvg" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="rgba(168,85,247,0.08)"
                strokeWidth="2"
              />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="url(#transitionGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="72 217"
                className="koma-transition__logoRingArc"
              />
              <defs>
                <linearGradient id="transitionGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="koma-transition__logoIcon">
            <BrandMark />
          </div>
        </div>

        <div className="koma-transition__brand">
          <span className="koma-transition__brandName">
            {t("brand.name")}<span>{t("brand.studioSuffix")}</span>
          </span>
        </div>

        <div className="koma-transition__progress">
          <div className="koma-transition__progressTrack">
            <div className="koma-transition__progressFill" />
          </div>
        </div>

        <div className="koma-transition__message" key={displayedMessage}>
          {displayedMessage}
        </div>

        {variant !== "minimal" && (
          <div className="koma-transition__sfx" aria-hidden="true">
            <span className="koma-transition__sfx-char koma-transition__sfx-char--1">쾅</span>
            <span className="koma-transition__sfx-char koma-transition__sfx-char--2">휙</span>
            <span className="koma-transition__sfx-char koma-transition__sfx-char--3">팡</span>
          </div>
        )}
      </div>

      <div className="koma-transition__corner koma-transition__corner--tl" aria-hidden="true" />
      <div className="koma-transition__corner koma-transition__corner--tr" aria-hidden="true" />
      <div className="koma-transition__corner koma-transition__corner--bl" aria-hidden="true" />
      <div className="koma-transition__corner koma-transition__corner--br" aria-hidden="true" />
    </div>
  );
};
