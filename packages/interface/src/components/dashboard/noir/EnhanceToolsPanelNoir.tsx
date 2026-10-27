import React from "react";
import { m, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  AlertTriangle,
  Layers,
  FolderOpen,
  Download,
  ExternalLink,
  ChevronDown,
  Cpu,
  Package,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  BookOpen,
} from "lucide-react";
import { AioSection } from "../../../pages/AioSection";
import { EnhanceProfile, EnhanceScale } from "../../../types/dashboard.types";
import { cn } from "../../../utils/dashboard.utils";
import { desktopBridge } from "@/lib/desktop-bridge";
import { useI18n } from "../../../i18n";

const EASE = [0.22, 1, 0.36, 1] as const;

interface EnhanceModelLike {
  id: string;
  name: string;
  description: string;
  installStrategy?: string;
  docsUrl?: string;
}

interface InstallStateLike {
  status: string;
}

interface EnhanceToolsPanelProps {
  isDesktopRuntime: boolean;
  enhanceScale: number;
  setEnhanceScale: (value: 2 | 4) => void;
  enhanceProfile: string;
  setEnhanceProfile: (value: string) => void;
  enhanceOutputFormat: "png" | "webp";
  setEnhanceOutputFormat: (value: "png" | "webp") => void;
  selectedEnhanceModel: EnhanceModelLike | null;
  selectedEnhanceInstallState: InstallStateLike | null;
  filteredEnhanceModels: EnhanceModelLike[];
  enhanceActionBusy: boolean;
  processing: boolean;
  imagesCount: number;
  hasQuotaForCurrentBatch?: boolean;
  quotaLimitButtonTitle?: string;
  setEnhanceModelId: (value: string) => void;
  setEnhanceModelManagerOpen: (value: boolean) => void;
  importSelectedEnhanceModel: () => void;
  installSelectedEnhanceModel: () => void;
  processEnhance: () => void;
  enhanceProfileLabels: Record<string, string>;
  enhanceOutputFormats: Array<{ value: "png" | "webp"; label: string }>;
}

function BrutalSelect({
  value,
  onChange,
  disabled,
  children,
  ariaLabel,
}: {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div className="relative group">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          "appearance-none w-full bg-ink-2 text-paper px-3 py-2.5 pr-9",
          "font-mono text-[11px] uppercase tracking-[0.12em]",
          "border border-paper/15 panel-cut-sm",
          "transition-all duration-200 ease-out",
          "hover:border-crimson/50 hover:shadow-[3px_3px_0_0_rgba(255,46,99,0.25)]",
          "focus:border-crimson focus:shadow-[3px_3px_0_0_#ff2e63] focus-visible:outline-none",
          "disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:shadow-none",
        )}
      >
        {children}
      </select>
      <ChevronDown
        size={12}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-crimson pointer-events-none transition-transform duration-200 group-focus-within:translate-y-[-60%]"
        aria-hidden
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   KickerLabel — JetBrains Mono kicker tag
──────────────────────────────────────────────────────────────── */
function KickerLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="kicker flex items-center gap-1.5">
      <span className="inline-block w-1 h-1 bg-crimson" aria-hidden />
      {children}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────
   InfoNote — paper/gold/crimson note variants
──────────────────────────────────────────────────────────────── */
function InfoNote({
  variant,
  icon: Icon,
  children,
}: {
  variant: "info" | "warning";
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  const accent =
    variant === "warning"
      ? "border-gold/40 bg-gold/[0.04] text-gold"
      : "border-azure/40 bg-azure/[0.04] text-azure";
  return (
    <div
      className={cn(
        "flex items-start gap-2 px-3 py-2 panel-cut-sm border",
        "font-mono text-[10px] leading-relaxed tracking-wide",
        accent,
      )}
    >
      <Icon size={11} className="mt-px shrink-0" aria-hidden />
      <span className="text-paper/80">{children}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   StatusStamp — hanko-style status carimbo
──────────────────────────────────────────────────────────────── */
function StatusStamp({
  state,
  label,
}: {
  state: "ready" | "missing" | "active";
  label: string;
}) {
  const styles = {
    ready: "border-mint/60 text-mint bg-mint/[0.06]",
    missing: "border-crimson/60 text-crimson bg-crimson/[0.06]",
    active: "border-gold/60 text-gold bg-gold/[0.06]",
  }[state];

  return (
    <span
      className={cn(
        "stamp inline-flex items-center gap-1.5 px-2 py-1",
        "border font-mono text-[10px] uppercase tracking-[0.18em]",
        "rotate-[-1deg]",
        styles,
      )}
    >
      {state === "ready" && <CheckCircle2 size={9} aria-hidden />}
      {state === "missing" && <XCircle size={9} aria-hidden />}
      {state === "active" && <Loader2 size={9} className="animate-spin" aria-hidden />}
      {label}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT — EnhanceToolsPanel V2
════════════════════════════════════════════════════════════════ */
export default function EnhanceToolsPanel({
  isDesktopRuntime,
  enhanceScale,
  setEnhanceScale,
  enhanceProfile,
  setEnhanceProfile,
  enhanceOutputFormat,
  setEnhanceOutputFormat,
  selectedEnhanceModel,
  selectedEnhanceInstallState,
  filteredEnhanceModels,
  enhanceActionBusy,
  processing,
  imagesCount,
  hasQuotaForCurrentBatch = true,
  quotaLimitButtonTitle = '',
  setEnhanceModelId,
  setEnhanceModelManagerOpen,
  importSelectedEnhanceModel,
  installSelectedEnhanceModel,
  processEnhance,
  enhanceProfileLabels,
  enhanceOutputFormats,
}: EnhanceToolsPanelProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  const statusState: "ready" | "missing" =
    !isDesktopRuntime || !selectedEnhanceInstallState
      ? "missing"
      : selectedEnhanceInstallState.status === "installed" ||
        selectedEnhanceInstallState.status === "update_available"
        ? "ready"
        : "missing";

  const statusLabel = !isDesktopRuntime
    ? t("dashboard.enhance.status.desktopRequired")
    : !selectedEnhanceInstallState
      ? t("dashboard.enhance.status.selectModel")
      : selectedEnhanceInstallState.status === "installed" ||
        selectedEnhanceInstallState.status === "update_available"
        ? t("dashboard.enhance.status.ready")
        : selectedEnhanceModel?.installStrategy === "manual_import"
          ? t("dashboard.enhance.status.notImported")
          : t("dashboard.enhance.status.notInstalled");

  const canExecute =
    !processing &&
    imagesCount > 0 &&
    hasQuotaForCurrentBatch &&
    isDesktopRuntime &&
    !!selectedEnhanceInstallState &&
    (selectedEnhanceInstallState.status === "installed" ||
      selectedEnhanceInstallState.status === "update_available");

  const containerAnim = reduceMotion
    ? {}
    : {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.4, ease: EASE, staggerChildren: 0.06 },
    };

  const itemAnim = reduceMotion
    ? {}
    : {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.5, ease: EASE },
    };

  return (
    <m.div className="koma-mode-tools relative" {...containerAnim}>
      {/* Decorative vertical katakana accent */}
      <span
        className="v-text absolute -left-5 top-8 font-mono text-[10px] tracking-[0.4em] text-crimson/30 select-none pointer-events-none"
        aria-hidden
      >
        拡張 ・ ENHANCE
      </span>

      {/* ═══ MODE TAG ═══ */}
      <m.div
        {...itemAnim}
        className="flex items-center justify-between mb-4 pb-3 border-b border-paper/8"
      >
        <span className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 bg-crimson"
            style={{
              animation: reduceMotion ? undefined : "blink 1.4s steps(2) infinite",
            }}
            aria-hidden
          />
          <span className="kicker">{t("dashboard.enhance.modeTag")}</span>
        </span>
        <span className="font-mono text-[10px] text-paper/40 uppercase tracking-[0.18em]">
          v2.0 // upscaler
        </span>
      </m.div>

      {/* ═══ CONFIG ═══ */}
      <AioSection icon={Wand2} title={t("dashboard.enhance.title")}>
        <m.div {...itemAnim} className="flex flex-col gap-4">
          <InfoNote variant="info" icon={Wand2}>
            {isDesktopRuntime
              ? t("dashboard.enhance.localHint")
              : t("dashboard.enhance.desktopRequiredHint")}
          </InfoNote>

          {/* Scale + Profile */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <KickerLabel>{t("dashboard.enhance.scale")}</KickerLabel>
              <BrutalSelect
                value={enhanceScale}
                onChange={(e) =>
                  setEnhanceScale(parseInt(e.target.value, 10) as EnhanceScale)
                }
                ariaLabel={t("dashboard.enhance.scale")}
              >
                <option value={2}>{t("dashboard.enhance.scale.2x")}</option>
                <option value={4}>{t("dashboard.enhance.scale.4x")}</option>
              </BrutalSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <KickerLabel>{t("dashboard.enhance.profile")}</KickerLabel>
              <BrutalSelect
                value={enhanceProfile}
                onChange={(e) => setEnhanceProfile(e.target.value as EnhanceProfile)}
                ariaLabel={t("dashboard.enhance.profile")}
              >
                {Object.entries(enhanceProfileLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </BrutalSelect>
            </div>
          </div>

          {/* Model + Format */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <KickerLabel>{t("dashboard.enhance.model")}</KickerLabel>
              <BrutalSelect
                value={selectedEnhanceModel?.id ?? ""}
                onChange={(e) => setEnhanceModelId(e.target.value)}
                disabled={filteredEnhanceModels.length === 0}
                ariaLabel={t("dashboard.enhance.model")}
              >
                {filteredEnhanceModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </BrutalSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <KickerLabel>{t("dashboard.enhance.format")}</KickerLabel>
              <BrutalSelect
                value={enhanceOutputFormat}
                onChange={(e) =>
                  setEnhanceOutputFormat(e.target.value as "png" | "webp")
                }
                ariaLabel={t("dashboard.enhance.format")}
              >
                {enhanceOutputFormats.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </BrutalSelect>
            </div>
          </div>
        </m.div>
      </AioSection>

      {/* ═══ MODEL STATUS ═══ */}
      <AioSection
        icon={Layers}
        title={t("dashboard.enhance.status.title")}
        defaultOpen={true}
      >
        <AnimatePresence mode="wait">
          {selectedEnhanceModel ? (
            <m.div
              key="model-card"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="flex flex-col gap-3"
            >
              {/* Card header */}
              <div
                className={cn(
                  "glass panel-cut-sm p-4 border",
                  "border-paper/8 hover:border-crimson/25",
                  "transition-colors duration-300",
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package size={14} className="text-crimson shrink-0" aria-hidden />
                    <span className="font-display font-black text-sm uppercase tracking-tight text-paper truncate">
                      {selectedEnhanceModel.name}
                    </span>
                  </div>
                  <StatusStamp state={statusState} label={statusLabel} />
                </div>

                <p className="text-paper/55 text-[11px] leading-relaxed font-mono">
                  {selectedEnhanceModel.description}
                </p>

                {selectedEnhanceModel.installStrategy === "manual_import" && (
                  <div className="mt-3">
                    <InfoNote variant="warning" icon={AlertTriangle}>
                      {t("dashboard.enhance.importHint")}
                    </InfoNote>
                  </div>
                )}
              </div>

              {/* Action row */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={!isDesktopRuntime}
                  onClick={() => setEnhanceModelManagerOpen(true)}
                  className={cn(
                    "btn-ghost panel-cut-sm px-3 py-2.5",
                    "flex flex-col items-center gap-1",
                    "font-mono text-[10px] uppercase tracking-wider",
                    "disabled:opacity-35 disabled:cursor-not-allowed",
                  )}
                >
                  <Layers size={13} aria-hidden />
                  <span>{t("dashboard.enhance.action.manage")}</span>
                </button>

                <button
                  type="button"
                  disabled={
                    !isDesktopRuntime ||
                    !selectedEnhanceModel ||
                    enhanceActionBusy ||
                    (selectedEnhanceModel.installStrategy === "manual_import"
                      ? false
                      : selectedEnhanceInstallState?.status === "installed" ||
                      selectedEnhanceInstallState?.status === "update_available")
                  }
                  onClick={
                    selectedEnhanceModel.installStrategy === "manual_import"
                      ? importSelectedEnhanceModel
                      : installSelectedEnhanceModel
                  }
                  className={cn(
                    "btn-ghost panel-cut-sm px-3 py-2.5",
                    "flex flex-col items-center gap-1",
                    "font-mono text-[10px] uppercase tracking-wider",
                    "disabled:opacity-35 disabled:cursor-not-allowed",
                  )}
                >
                  {enhanceActionBusy ? (
                    <>
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                      <span>…</span>
                    </>
                  ) : selectedEnhanceModel.installStrategy === "manual_import" ? (
                    <>
                      <FolderOpen size={13} aria-hidden />
                      <span>{t("dashboard.enhance.action.import")}</span>
                    </>
                  ) : (
                    <>
                      <Download size={13} aria-hidden />
                      <span>{t("dashboard.enhance.action.install")}</span>
                    </>
                  )}
                </button>

                {selectedEnhanceModel.docsUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (desktopBridge.desktop?.openCommunityLink) {
                        void desktopBridge.desktop.openCommunityLink(
                          selectedEnhanceModel.docsUrl!,
                        );
                        return;
                      }
                      window.open(
                        selectedEnhanceModel.docsUrl,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                    className={cn(
                      "btn-ghost panel-cut-sm px-3 py-2.5",
                      "flex flex-col items-center gap-1",
                      "font-mono text-[10px] uppercase tracking-wider",
                    )}
                  >
                    <ExternalLink size={13} aria-hidden />
                    <span>{t("dashboard.enhance.action.source")}</span>
                  </button>
                ) : (
                  <div
                    className="panel-cut-sm px-3 py-2.5 flex flex-col items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-paper/20 border border-paper/5"
                    aria-hidden
                  >
                    <BookOpen size={13} />
                    <span>n/a</span>
                  </div>
                )}
              </div>
            </m.div>
          ) : (
            <m.div
              key="empty"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "flex flex-col items-center justify-center gap-2 py-8",
                "glass panel-cut-sm border border-paper/5",
              )}
            >
              <Terminal size={20} className="text-paper/30" aria-hidden />
              <p className="koma-tools-hint text-center text-paper/40">
                {t("dashboard.enhance.selectAboveHint")}
              </p>
            </m.div>
          )}
        </AnimatePresence>
      </AioSection>

      {/* ═══ EXECUTE BAR ═══ */}
      <m.div
        {...itemAnim}
        className="koma-execute-bar mt-4"
      >
        <m.button
          type="button"
          disabled={!canExecute}
          title={quotaLimitButtonTitle}
          onClick={processEnhance}
          aria-busy={processing}
          whileHover={reduceMotion || !canExecute ? undefined : { x: -3, y: -3 }}
          whileTap={reduceMotion || !canExecute ? undefined : { x: 0, y: 0 }}
          transition={{ ease: EASE, duration: 0.18 }}
          className={cn(
            "btn-primary panel-cut-sm w-full px-4 py-3.5",
            "flex items-center justify-center gap-2",
            "font-display font-black uppercase tracking-[0.08em] text-sm",
            "disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0",
            processing && "koma-execute-bar__btn--processing",
          )}
          style={
            !reduceMotion && canExecute
              ? { boxShadow: "0 0 0 0 transparent" }
              : undefined
          }
        >
          {processing ? (
            <>
              <Loader2
                size={14}
                className="animate-spin"
                aria-hidden
              />
              {t("dashboard.enhance.action.processing")}
            </>
          ) : (
            <>
              <Wand2 size={14} aria-hidden />
              {t("dashboard.enhance.action.run")}
              <span className="ml-2 font-mono text-[10px] text-ink/60 normal-case tracking-wider">
                {imagesCount > 0 ? `// ${imagesCount} img` : "// idle"}
              </span>
            </>
          )}
        </m.button>
      </m.div>

      {/* Decorative footer ticker */}
      <div
        className="mt-3 flex items-center gap-2 font-mono text-[9px] text-paper/25 uppercase tracking-[0.25em] overflow-hidden"
        aria-hidden
      >
        <Cpu size={9} />
        <span className="truncate">
          upscaler_pipeline · {isDesktopRuntime ? "local_runtime" : "cloud_only"} ·
          koma_studio_v2
        </span>
      </div>
    </m.div>
  );
}
