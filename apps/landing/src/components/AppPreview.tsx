"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Circle,
  Download,
  Eye,
  FolderUp,
  Languages,
  Layers,
  LayoutGrid,
  Monitor,
  Pause,
  Play,
  RefreshCcw,
  RotateCw,
  Search,
  Settings,
  UserRound,
  Wand2,
  ZoomIn,
  ZoomOut,
  Zap,
} from "lucide-react";

import { SectionHeader } from "./ui/SectionHeader";
import {
  APP_MODES,
  CALL_OUTS,
  FINAL_HOLD_MS,
  FINAL_REVEAL_MS,
  FooterBar,
  LEFT_STATS,
  MODE_DEMO_CONFIGS,
  PREVIEW_ASSETS,
  PanelSection,
  PipelineTile,
  SelectField,
  TOOL_STRIP,
  TOPBAR_MENUS,
  TopbarIconButton,
  cx,
  type AppModeId,
  type DemoState,
  type PreviewAsset,
  type StageOverlayProps,
  type TimelineStep,
} from "./app-preview/shared";
function LeftSidebar({
  preview,
  isProcessing,
  currentStep,
}: {
  preview: PreviewAsset;
  isProcessing: boolean;
  currentStep: TimelineStep;
}) {
  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-white/6 bg-[#070b15]/96 xl:flex xl:flex-col">
      <div className="border-b border-white/6 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-koma-purple/20 bg-gradient-to-br from-koma-purple/18 to-koma-cyan/14 text-koma-purple-light">
            <Layers size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1 text-sm font-bold text-koma-text">
              <span>KŌMA</span>
              <span className="gradient-text-static">Studio</span>
              <span className="text-[9px] font-medium text-koma-purple-light/80">v1.0.1-beta.1</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-koma-muted">WORKSPACE</div>
          </div>
        </div>
      </div>

      <div className="border-b border-white/6 px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-koma-text-secondary/80">
            FREE · LOCAL STATS
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-300">
            Active
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {LEFT_STATS.map((item) => (
            <div
              key={item.label}
              className="rounded-[18px] border border-white/8 bg-white/[0.025] px-2 py-3 text-center"
            >
              <div className="text-[10px] font-semibold text-koma-muted">{item.label}</div>
              <div className="mt-2 text-[15px] font-bold text-koma-text">{item.value}</div>
              <div className="mt-1 text-[9px] leading-4 text-koma-muted/70">{item.hint}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-4 text-koma-muted/70">
          Recent local processing activity. Counters reset automatically by period.
        </p>
      </div>

      <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-koma-text-secondary/80">
          FILES (1)
        </span>
        <button
          type="button"
          aria-label="Refresh workspace list"
          title="Refresh workspace list"
          className="rounded-lg border border-white/6 bg-black/20 p-1 text-koma-muted"
        >
          <RefreshCcw size={12} />
        </button>
      </div>

      <div className="flex-1 px-4 py-4">
        <div className="rounded-[22px] border border-koma-purple/18 bg-koma-purple/10 p-3 shadow-[0_0_28px_rgba(168,85,247,0.08)]">
          <div className="flex items-center gap-3">
            <div className="relative h-[56px] w-[44px] overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <Image
                src={preview.before}
                alt="Loaded page thumbnail"
                fill
                sizes="44px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-semibold text-koma-text">{preview.fileName}</div>
              <div className="mt-1 text-[10px] text-koma-muted">{preview.fileDims}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] text-koma-muted">Pipeline</span>
            <span className={cx("text-[10px] font-semibold", isProcessing ? currentStep.accentClass : "text-emerald-300")}>
              {isProcessing ? currentStep.label : "Ready"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/6 px-4 py-4">
        <div className="rounded-[22px] border border-dashed border-koma-purple/18 bg-koma-purple/6 px-4 py-5 text-center">
          <FolderUp size={14} className="mx-auto mb-2 text-koma-purple-light" />
          <div className="text-[11px] font-semibold text-koma-text-secondary">Drag or click</div>
          <div className="mt-1 text-[9px] leading-4 text-koma-muted">
            JPG, PNG, WEBP, ZIP, PDF, CBZ, PSD
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  zoom,
  onZoomIn,
  onZoomOut,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-4 border-b border-white/6 bg-[#090d18]/96 px-4">
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        {TOPBAR_MENUS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className={cx(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors",
                item.active
                  ? "border-koma-purple/20 bg-koma-purple/12 text-koma-purple-light"
                  : "border-transparent text-koma-muted hover:text-koma-text-secondary",
              )}
            >
              <Icon size={12} />
              <span>{item.label}</span>
              {item.compact ? (
                <span className="rounded-full border border-white/8 bg-black/20 px-1.5 py-0.5 text-[9px] text-koma-muted">
                  A/M
                </span>
              ) : (
                <ChevronDown size={11} className="text-koma-muted/80" />
              )}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-xl border border-white/6 bg-black/20 px-3 py-2 text-[10px] font-semibold text-koma-text-secondary lg:flex">
          <Search size={12} className="text-koma-muted" />
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="Zoom out preview"
            title="Zoom out preview"
            className="text-koma-muted transition-colors hover:text-koma-text"
          >
            <ZoomOut size={12} />
          </button>
          <span className="w-10 text-center">{zoom}%</span>
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="Zoom in preview"
            title="Zoom in preview"
            className="text-koma-muted transition-colors hover:text-koma-text"
          >
            <ZoomIn size={12} />
          </button>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <TopbarIconButton icon={RefreshCcw} label="Refresh panel" />
          <TopbarIconButton icon={Download} label="Download preview" />
          <TopbarIconButton icon={RotateCw} label="Rotate preview" />
          <TopbarIconButton icon={LayoutGrid} label="Grid layout" active />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-black/20 px-2.5 py-2 text-[10px] font-medium text-koma-text-secondary">
          <UserRound size={12} className="text-koma-purple-light" />
          <span>Klaus</span>
          <ChevronDown size={11} className="text-koma-muted" />
        </div>
      </div>
    </div>
  );
}

function StageOverlay({ step, stepProgress, pipelineProgress, revealProgress }: StageOverlayProps) {
  if (revealProgress > 0.001) {
    return null;
  }

  const commonCardClass =
    "absolute rounded-2xl border bg-[#060914]/82 px-3 py-2 backdrop-blur-md";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${step.id}-${step.index}`}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0"
      >
        {step.id === "detect" ? (
          <>
            {[
              { top: "10%", left: "15%", width: "46%", height: "18%" },
              { top: "42%", left: "52%", width: "27%", height: "10%" },
              { top: "69%", left: "18%", width: "55%", height: "13%" },
            ].map((box, index) => (
              <motion.div
                key={`${step.id}-${index}`}
                className="absolute rounded-[24px] border border-cyan-300/70 bg-cyan-300/12"
                style={box}
                animate={{ opacity: [0.25, 0.88, 0.25], scale: [0.98, 1, 0.98] }}
                transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, delay: index * 0.12 }}
              />
            ))}
            <motion.div
              className="absolute inset-x-[8%] h-16 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.26)_0%,rgba(34,211,238,0)_72%)] blur-2xl"
              style={{ top: `${12 + stepProgress * 0.62}%` }}
            />
          </>
        ) : null}

        {step.id === "ocr" ? (
          <>
            <div className={cx(commonCardClass, "left-[10%] top-[10%] border-violet-300/25")}>
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">
                OCR map
              </div>
              <div className="mt-1 text-[11px] text-koma-text-secondary">Japanese tokens locked</div>
            </div>
            {[
              { top: "21%", left: "24%", label: "JP-01" },
              { top: "48%", left: "56%", label: "SFX-02" },
              { top: "72%", left: "30%", label: "TXT-03" },
            ].map((tag, index) => (
              <motion.div
                key={tag.label}
                className="absolute rounded-full border border-violet-300/28 bg-[#080b16]/86 px-2 py-1 text-[10px] font-medium text-violet-100"
                style={{ top: tag.top, left: tag.left }}
                animate={{ y: [0, -4, 0], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, delay: index * 0.14 }}
              >
                {tag.label}
              </motion.div>
            ))}
            <motion.div
              className="absolute inset-y-[8%] left-[46%] w-10 rounded-full bg-[linear-gradient(180deg,rgba(196,181,253,0.0)_0%,rgba(196,181,253,0.25)_45%,rgba(196,181,253,0.0)_100%)] blur-xl"
              animate={{ x: ["-24%", "24%", "-24%"] }}
              transition={{ duration: 1.3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
          </>
        ) : null}

        {step.id === "translate" ? (
          <motion.div
            className="absolute bottom-[10%] left-[10%] right-[10%] rounded-[24px] border border-fuchsia-300/24 bg-[#080b16]/84 p-4 backdrop-blur-md"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200/80">
                Translation Memory
              </div>
              <span className="rounded-full border border-fuchsia-300/24 bg-fuchsia-300/10 px-2 py-1 text-[9px] font-semibold text-fuchsia-100">
                PT-BR draft
              </span>
            </div>
            <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-koma-muted">Source</div>
              <div className="mt-1 text-[11px] text-koma-text-secondary">The brat&apos;s missing two fingers...</div>
              <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-koma-muted">Target</div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-koma-text">
                <span>Ele esta faltando dois deles...</span>
                <span className="text-fuchsia-300 animate-pulse">▍</span>
              </div>
            </div>
          </motion.div>
        ) : null}

        {step.id === "segment" ? (
          <>
            <div className="absolute left-[17%] top-[12%] h-[18%] w-[44%] rounded-[26px] border border-emerald-300/65 bg-emerald-300/12" />
            <div className="absolute left-[19%] top-[69%] h-[13%] w-[54%] rounded-[22px] border border-emerald-300/52 bg-emerald-300/10" />
            <motion.div
              className="absolute left-[41%] top-[29%] h-[20%] w-px bg-emerald-300/55"
              animate={{ scaleY: [0.6, 1, 0.6], opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY }}
            />
            <motion.div
              className="absolute left-[41%] top-[49%] h-px w-[16%] bg-emerald-300/55"
              animate={{ scaleX: [0.55, 1, 0.55], opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, delay: 0.12 }}
            />
            {[
              { top: "28%", left: "40%" },
              { top: "48%", left: "40%" },
              { top: "48%", left: "56%" },
              { top: "75%", left: "56%" },
            ].map((node, index) => (
              <motion.div
                key={`${step.id}-node-${index}`}
                className="absolute h-3 w-3 rounded-full border border-emerald-200/80 bg-emerald-300/40"
                style={{ top: node.top, left: node.left }}
                animate={{ scale: [1, 1.25, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, delay: index * 0.08 }}
              />
            ))}
          </>
        ) : null}

        {step.id === "clean" ? (
          <>
            <motion.div
              className="absolute left-[26%] top-[16%] h-28 w-28 rounded-full border border-sky-300/35 bg-sky-300/12 blur-[1px]"
              animate={{ x: ["-8%", "16%", "-8%"], y: [0, 14, 0], scale: [0.92, 1.08, 0.92] }}
              transition={{ duration: 1.9, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
            <div className={cx(commonCardClass, "bottom-[12%] left-[9%] border-sky-300/24")}>
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-200/80">
                Healing pass
              </div>
              <div className="mt-1 text-[11px] text-koma-text-secondary">Rebuilding linework + screentone texture</div>
            </div>
          </>
        ) : null}

        {step.id === "render" ? (
          <>
            <div className="absolute left-[16%] top-[10%] h-[18%] w-[46%] rounded-[26px] border border-amber-300/45 bg-amber-300/10" />
            <div className="absolute left-[50%] top-[41%] h-[9%] w-[24%] rounded-[18px] border border-amber-300/32 bg-amber-300/8" />
            <div className="absolute left-[18%] top-[70%] h-[12%] w-[52%] rounded-[22px] border border-amber-300/32 bg-amber-300/8" />
            <motion.div
              className="absolute bottom-[10%] right-[10%] rounded-[22px] border border-amber-300/24 bg-[#080b16]/84 px-3 py-2 backdrop-blur-md"
              animate={{ y: [0, -5, 0], opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                Typesetting
              </div>
              <div className="mt-1 text-[11px] text-koma-text-secondary">CC Wild Words · PT-BR</div>
            </motion.div>
          </>
        ) : null}

        <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
          <span className={cx("rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em]", step.accentClass)}>
            {step.label}
          </span>
          <span className="rounded-full border border-white/8 bg-black/30 px-2 py-1 text-[9px] font-semibold text-koma-text-secondary">
            {Math.round(pipelineProgress)}%
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function WorkspaceStage({
  mode,
  demoState,
  currentStep,
  stepProgress,
  pipelineProgress,
  revealProgress,
  zoom,
}: {
  mode: AppModeId;
  demoState: DemoState;
  currentStep: TimelineStep;
  stepProgress: number;
  pipelineProgress: number;
  revealProgress: number;
  zoom: number;
}) {
  const preview = PREVIEW_ASSETS[mode];
  const modeLabel = APP_MODES.find((item) => item.id === mode)?.label ?? "All-in-One";
  const stageScale = zoom / 125;
  const revealPct = Math.round(revealProgress * 100);

  return (
    <div className="relative flex flex-1 overflow-hidden bg-[#050811]">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(168,85,247,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,1) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />
      <div className="absolute inset-y-0 left-[14%] w-px bg-koma-purple/12" />
      <div className="absolute inset-y-0 right-[18%] w-px bg-koma-cyan/8" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.12),transparent_62%)]" />

      <div className="relative z-10 flex w-full items-center justify-center px-5 py-5">
        <div className="w-full max-w-[640px] rounded-[28px] border border-white/8 bg-[#0b1120]/92 p-4 shadow-[0_32px_90px_rgba(0,0,0,0.42)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-koma-purple-light">
                {preview.chapterLabel}
              </div>
              <div className="mt-1 text-[12px] text-koma-text-secondary">
                {demoState === "running"
                  ? currentStep.detail
                  : demoState === "finished"
                    ? "Final translated page rendered. The result is only revealed after the last pass completes."
                    : "Original source page loaded. The result stays hidden until the pipeline finishes."}
              </div>
            </div>
            <div className="rounded-full border border-white/8 bg-black/25 px-3 py-2 text-right">
              <div className="text-[9px] uppercase tracking-[0.18em] text-koma-muted">Pipeline</div>
              <div className={cx("mt-1 text-sm font-semibold", demoState === "running" ? currentStep.accentClass : "text-koma-text")}>
                {demoState === "finished" ? "Done" : `${Math.round(pipelineProgress)}%`}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/6 bg-[#10162a] p-3">
            <div className="rounded-[20px] border border-black/16 bg-[#f4efe7] px-4 py-4 shadow-inner shadow-black/5">
              <div className="mb-3 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>Preview canvas · {modeLabel}</span>
                <span>{demoState === "finished" ? "Release-ready" : "Original artboard"}</span>
              </div>

              <div className="relative mx-auto aspect-[0.72] max-w-[430px] overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                <div
                  className="absolute inset-0 origin-center transition-transform duration-300"
                  style={{ transform: `scale(${stageScale})` }}
                >
                  <Image
                    src={preview.before}
                    alt={`${modeLabel} original preview`}
                    fill
                    sizes="(min-width: 1280px) 430px, 65vw"
                    className="object-contain"
                    loading="lazy"
                    fetchPriority="low"
                  />

                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{
                      clipPath: `inset(0 ${100 - revealPct}% 0 0)`,
                      opacity: revealProgress > 0 || demoState === "finished" ? 1 : 0,
                    }}
                  >
                    <Image
                      src={preview.after}
                      alt={`${modeLabel} processed preview`}
                      fill
                      sizes="(min-width: 1280px) 430px, 65vw"
                      className="object-contain"
                      loading="lazy"
                      fetchPriority="low"
                    />
                  </div>

                  <StageOverlay
                    step={currentStep}
                    stepProgress={stepProgress}
                    pipelineProgress={pipelineProgress}
                    revealProgress={revealProgress}
                  />

                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,16,0.04),transparent_22%,transparent_78%,rgba(6,8,16,0.16))]" />

                  <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-[#060914]/86 px-2.5 py-1 text-[9px] font-semibold text-koma-text backdrop-blur-md">
                    {demoState === "running"
                      ? currentStep.shortLabel
                      : demoState === "finished"
                        ? "Result ready"
                        : "Original page"}
                  </div>

                  {revealProgress > 0 ? (
                    <motion.div
                      className="absolute inset-y-0 w-5 bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.72)_50%,rgba(255,255,255,0)_100%)] mix-blend-screen blur-md"
                      style={{ left: `calc(${revealPct}% - 10px)` }}
                      animate={{ opacity: [0.65, 0.9, 0.45] }}
                      transition={{ duration: 0.35, repeat: Number.POSITIVE_INFINITY }}
                    />
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-[#060914]/78 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-koma-text-secondary">
                    {preview.fileName}
                  </span>
                  <span className="rounded-full border border-white/10 bg-[#060914]/78 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-koma-muted">
                    {preview.fileDims}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-koma-text-secondary">
                  <Circle size={8} fill={demoState === "running" ? "#22d3ee" : demoState === "finished" ? "#10b981" : "#94a3b8"} className={demoState === "running" ? "animate-pulse text-cyan-300" : demoState === "finished" ? "text-emerald-400" : "text-slate-400"} />
                  <span>
                    {demoState === "running"
                      ? `${currentStep.label} · ${Math.round(stepProgress)}%`
                      : demoState === "finished"
                        ? "Rendered output visible"
                        : "Awaiting pipeline run"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RightSidebar({
  mode,
  demoState,
  currentStep,
  completedSteps,
  pipelineProgress,
  timeline,
  modeConfig,
  onRunProcess,
}: {
  mode: AppModeId;
  demoState: DemoState;
  currentStep: TimelineStep;
  completedSteps: number;
  pipelineProgress: number;
  timeline: TimelineStep[];
  modeConfig: (typeof MODE_DEMO_CONFIGS)[AppModeId];
  onRunProcess: () => void;
}) {
  const modeLabel = APP_MODES.find((item) => item.id === mode)?.label ?? "All-in-One";

  return (
    <aside className="hidden w-[294px] shrink-0 border-l border-white/6 bg-[#080c17]/96 lg:flex lg:flex-col">
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-4">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-koma-purple-light" />
          <span className="text-[14px] font-semibold text-koma-text">{modeConfig.panelTitle}</span>
        </div>
        <button
          type="button"
          aria-label="Preview visibility"
          title="Preview visibility"
          className="rounded-lg border border-white/6 bg-black/20 p-1 text-koma-muted"
        >
          <Eye size={12} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="rounded-[22px] border border-white/7 bg-[#0d1120]/84 p-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-[16px] border border-koma-purple/18 bg-koma-purple/12 px-3 py-3 text-left text-[11px] font-semibold text-koma-text"
            >
              <div className="flex items-center gap-2">
                <Zap size={12} className="text-koma-purple-light" />
                <span>{modeConfig.modePrimaryPill}</span>
              </div>
            </button>
            <button
              type="button"
              className="rounded-[16px] border border-white/7 bg-black/18 px-3 py-3 text-left text-[11px] font-semibold text-koma-muted"
            >
              <div className="flex items-center gap-2">
                <Wand2 size={12} />
                <span>{modeConfig.modeSecondaryPill}</span>
              </div>
            </button>
          </div>
        </div>

        <PanelSection
          title="Pipeline"
          badge={`${Math.max(0, Math.min(completedSteps, timeline.length))}/${timeline.length}`}
        >
          <div className="grid grid-cols-3 gap-2">
            {timeline.map((step) => (
              <PipelineTile
                key={`${step.id}-${step.index}`}
                step={step}
                isActive={demoState === "running" && currentStep.index === step.index}
                isComplete={demoState === "finished" || completedSteps > step.index}
              />
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled
              className="rounded-[16px] border border-white/7 bg-black/18 px-3 py-2 text-[11px] font-medium text-koma-muted/70"
            >
              Rewind
            </button>
            <button
              type="button"
              disabled
              className="rounded-[16px] border border-white/7 bg-black/18 px-3 py-2 text-[11px] font-medium text-koma-muted/70"
            >
              Forward
            </button>
          </div>

          <p className="mt-3 text-[10px] leading-4 text-koma-muted">
            {demoState === "running"
              ? `${currentStep.shortLabel} · ${Math.round(pipelineProgress)}%`
              : demoState === "finished"
                ? modeConfig.doneHint
                : modeConfig.idleHint}
          </p>
        </PanelSection>

        {modeConfig.showLanguages ? (
          <PanelSection title="Languages">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <SelectField value={modeConfig.sourceLanguage ?? "Japanese"} />
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-koma-purple/18 bg-koma-purple/12 text-koma-purple-light">
                <Languages size={13} />
              </div>
              <SelectField value={modeConfig.targetLanguage ?? "Portuguese"} />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/7 bg-black/18 px-3 py-2 text-[10px] font-semibold text-koma-text-secondary"
              >
                Presets
              </button>
              <button
                type="button"
                className="rounded-xl border border-koma-purple/18 bg-koma-purple/12 px-3 py-2 text-[10px] font-semibold text-koma-purple-light"
              >
                Save
              </button>
              <button
                type="button"
                aria-label="Add language preset"
                title="Add language preset"
                className="rounded-xl border border-white/7 bg-black/18 px-3 py-2 text-[10px] font-semibold text-koma-muted"
              >
                +
              </button>
            </div>

            <p className="mt-3 text-[10px] leading-4 text-koma-muted">
              Source → OCR → translation flow. The preview only flips after the selected language pass completes.
            </p>
          </PanelSection>
        ) : null}

        <PanelSection title="Models & Config">
          <div className="grid grid-cols-6 gap-2">
            {TOOL_STRIP.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.icon.displayName ?? "tool"}-${index}`}
                  className="flex flex-col items-center gap-2 rounded-[16px] border border-white/7 bg-black/18 px-2 py-3"
                >
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-white/7 bg-white/[0.03] text-koma-text-secondary">
                    <Icon size={13} />
                    {item.active ? (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-koma-muted">
              {modeConfig.inspectorLabel}
            </div>
            <SelectField value={modeConfig.inspectorValue} />
          </div>

          <p className="mt-3 text-[10px] leading-4 text-koma-muted">
            {demoState === "running"
              ? `${modeLabel} is executing its own preview pipeline instead of falling back to AIO.`
              : `${modeLabel} now has a dedicated mock flow, dedicated CTA, and its own preview timing.`}
          </p>
        </PanelSection>
      </div>

      <div className="border-t border-white/6 px-4 py-4">
        <button
          type="button"
          onClick={onRunProcess}
          disabled={demoState === "running"}
          className={cx(
            "flex w-full items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-semibold transition-all",
            demoState === "running"
              ? "cursor-wait border border-amber-400/20 bg-amber-400/10 text-amber-300"
              : "border border-koma-purple/18 bg-gradient-to-r from-koma-purple to-[#c86bff] text-white shadow-[0_12px_32px_rgba(168,85,247,0.28)] hover:translate-y-[-1px]",
          )}
        >
          {demoState === "running" ? <Pause size={15} /> : <Play size={15} />}
          {demoState === "running" ? modeConfig.runningLabel : modeConfig.runLabel}
        </button>
      </div>
    </aside>
  );
}

export function AppPreview() {
  const [activeAppMode, setActiveAppMode] = useState<AppModeId>("aio");
  const [demoState, setDemoState] = useState<DemoState>("idle");
  const [timelineElapsed, setTimelineElapsed] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [runSeed, setRunSeed] = useState(0);
  const activeModeConfig = MODE_DEMO_CONFIGS[activeAppMode];

  const timeline = useMemo<TimelineStep[]>(
    () =>
      activeModeConfig.steps.map((step, index) => {
        const startMs = activeModeConfig.steps.slice(0, index).reduce(
          (total, current) => total + current.durationMs,
          0,
        );
        const endMs = startMs + step.durationMs;
        return { ...step, index, startMs, endMs };
      }),
    [activeModeConfig.steps],
  );

  const processDuration = timeline[timeline.length - 1]?.endMs ?? 0;
  const totalDemoDuration = processDuration + FINAL_REVEAL_MS + FINAL_HOLD_MS;

  useEffect(() => {
    if (demoState !== "running") {
      return;
    }

    let frameId = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const nextElapsed = now - startedAt;

      if (nextElapsed >= totalDemoDuration) {
        setTimelineElapsed(totalDemoDuration);
        setDemoState("finished");
        return;
      }

      setTimelineElapsed(nextElapsed);
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [demoState, runSeed, totalDemoDuration]);

  const currentStep = useMemo(() => {
    if (demoState === "finished") {
      return timeline[timeline.length - 1];
    }

    return timeline.find((step) => timelineElapsed < step.endMs) ?? timeline[timeline.length - 1];
  }, [demoState, timeline, timelineElapsed]);

  const completedSteps = useMemo(() => {
    if (demoState === "idle") {
      return 0;
    }

    if (demoState === "finished") {
      return timeline.length;
    }

    return timeline.filter((step) => timelineElapsed >= step.endMs).length;
  }, [demoState, timeline, timelineElapsed]);

  const pipelineProgress = useMemo(() => {
    if (demoState === "idle") {
      return 0;
    }

    if (demoState === "finished") {
      return 100;
    }

    return Math.min(100, (Math.min(timelineElapsed, processDuration) / processDuration) * 100);
  }, [demoState, processDuration, timelineElapsed]);

  const stepProgress = useMemo(() => {
    if (demoState === "idle") {
      return 0;
    }

    if (timelineElapsed >= processDuration) {
      return 100;
    }

    const span = currentStep.endMs - currentStep.startMs;
    return Math.max(0, Math.min(100, ((timelineElapsed - currentStep.startMs) / span) * 100));
  }, [currentStep, demoState, processDuration, timelineElapsed]);

  const revealProgress = useMemo(() => {
    if (demoState === "finished") {
      return 1;
    }

    if (timelineElapsed <= processDuration) {
      return 0;
    }

    return Math.max(0, Math.min(1, (timelineElapsed - processDuration) / FINAL_REVEAL_MS));
  }, [demoState, processDuration, timelineElapsed]);

  const runProcess = useCallback(() => {
    if (demoState === "running") {
      return;
    }

    setTimelineElapsed(0);
    setDemoState("running");
    setRunSeed((current) => current + 1);
  }, [demoState]);

  const handleModeChange = useCallback(
    (mode: AppModeId) => {
      if (demoState === "running") {
        return;
      }

      setActiveAppMode(mode);
      setTimelineElapsed(0);
      setDemoState("idle");
    },
    [demoState],
  );

  const preview = PREVIEW_ASSETS[activeAppMode];

  return (
    <section id="app-preview" className="relative overflow-hidden py-[var(--spacing-section)]">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          badge="Desktop Studio"
          title="See How KŌMA Looks in Real Workflow Use"
          subtitle="The preview mirrors the real desktop layout: local stats on the left, the canvas in the middle, and the AIO controls on the right."
        />

        <div className="mb-8 flex justify-center">
          <div className="flex flex-wrap justify-center gap-1.5 rounded-2xl border border-white/8 bg-[#0b1020]/78 p-1.5 backdrop-blur-xl">
            {APP_MODES.map((mode) => {
              const Icon = mode.icon;
              const active = activeAppMode === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleModeChange(mode.id)}
                  disabled={demoState === "running"}
                  className={cx(
                    "flex min-w-[96px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all sm:min-w-0",
                    active
                      ? "border-koma-purple/25 bg-koma-purple/14 text-koma-purple-light shadow-[0_0_18px_rgba(168,85,247,0.1)]"
                      : "border-transparent text-koma-muted hover:bg-white/[0.03] hover:text-koma-text-secondary",
                    demoState === "running" && "cursor-not-allowed opacity-70",
                  )}
                >
                  <Icon size={13} />
                  <span className="sm:hidden">{mode.shortLabel}</span>
                  <span className="hidden sm:inline">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative" style={{ perspective: 1400 }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7 }}
            className="relative z-10 mx-auto max-w-[1320px]"
          >
            <div className="overflow-hidden rounded-[30px] border border-white/8 bg-[#050811] shadow-[0_34px_120px_rgba(0,0,0,0.45)]">
              <div className="flex h-9 items-center border-b border-white/6 bg-[#080b15] px-3">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                </div>
                <span className="flex-1 text-center text-[10px] font-medium text-koma-muted">
                  KŌMA Studio — Desktop preview
                </span>
                <Monitor size={10} className="text-koma-muted" />
              </div>

              <div className="flex h-[520px] bg-[#050811] xl:h-[560px]">
                <LeftSidebar
                  preview={preview}
                  isProcessing={demoState === "running"}
                  currentStep={currentStep}
                />

                <div className="flex min-w-0 flex-1 flex-col">
                  <Topbar
                    zoom={zoom}
                    onZoomIn={() => setZoom((current) => Math.min(current + 25, 200))}
                    onZoomOut={() => setZoom((current) => Math.max(current - 25, 50))}
                  />

                  <WorkspaceStage
                    mode={activeAppMode}
                    demoState={demoState}
                    currentStep={currentStep}
                    stepProgress={stepProgress}
                    pipelineProgress={pipelineProgress}
                    revealProgress={revealProgress}
                    zoom={zoom}
                  />

                  <FooterBar
                    mode={activeAppMode}
                    demoState={demoState}
                    currentStep={currentStep}
                  />
                </div>

                <RightSidebar
                  mode={activeAppMode}
                  demoState={demoState}
                  currentStep={currentStep}
                  completedSteps={completedSteps}
                  pipelineProgress={pipelineProgress}
                  timeline={timeline}
                  modeConfig={activeModeConfig}
                  onRunProcess={runProcess}
                />
              </div>
            </div>

            <div
              className="pointer-events-none absolute inset-0 -z-10 blur-3xl opacity-30"
              style={{
                background: "radial-gradient(ellipse at center, rgba(168,85,247,0.16) 0%, transparent 72%)",
              }}
            />
          </motion.div>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CALL_OUTS.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.45 }}
              className="rounded-2xl border border-white/6 bg-white/[0.03] p-4 transition-colors hover:border-koma-purple/16"
            >
              <item.icon size={18} className="mb-2 text-koma-purple-light" />
              <div className="text-xs font-semibold text-koma-text-secondary">{item.label}</div>
              <div className="mt-1 text-[11px] leading-5 text-koma-muted">{item.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
