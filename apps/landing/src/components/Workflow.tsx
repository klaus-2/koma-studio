"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  Clock3,
  Film,
  FolderOpen,
  HardDrive,
  Layers,
  PenTool,
  Play,
  Rocket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { SectionHeader } from "./ui/SectionHeader";

interface WorkflowVideoFile {
  id: string;
  name: string;
  duration: string;
  size: string;
  resolution: string;
  status: "ready" | "latest" | "review";
  source: string;
}

interface WorkflowStep {
  id: number;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  body: string;
  notes: string[];
  color: string;
  gradient: string;
  videos: WorkflowVideoFile[];
}

const VIDEO_SOURCES = ["/bg-8.mp4", "/bg-7.mp4"] as const;

const steps: WorkflowStep[] = [
  {
    id: 0,
    icon: Layers,
    title: "Intelligent Ingestion",
    subtitle: "Drag in volumes, chapters, or raw scans",
    body:
      "KOMA instantly maps page order, detects spreads, and builds a structured production board. No manual sorting required.",
    notes: [
      "Auto-spread detection",
      "Smart page sequencing",
      "ZIP, RAR, and folder support",
    ],
    color: "#06b6d4",
    gradient: "from-cyan-500/20 to-cyan-900/5",
    videos: [
      {
        id: "ingest-raw-drop",
        name: "01_raw-drop_capture.mp4",
        duration: "00:12",
        size: "24.8 MB",
        resolution: "1920×1080",
        status: "latest",
        source: VIDEO_SOURCES[0],
      },
      {
        id: "ingest-spread-detect",
        name: "02_spread-detection_pass.mp4",
        duration: "00:19",
        size: "31.2 MB",
        resolution: "1920×1080",
        status: "ready",
        source: VIDEO_SOURCES[1],
      },
      {
        id: "ingest-sort-board",
        name: "03_chapter-board_ready.mp4",
        duration: "00:15",
        size: "26.4 MB",
        resolution: "1920×1080",
        status: "review",
        source: VIDEO_SOURCES[0],
      },
    ],
  },
  {
    id: 1,
    icon: Sparkles,
    title: "Seamless Art Restoration",
    subtitle: "AI-erased text with flawless background rebuild",
    body:
      "Our context-aware inpainting doesn't just erase—it rebuilds. Halftones, screentones, and line art are preserved flawlessly.",
    notes: [
      "Mask-aware inpainting",
      "Screentone preservation",
      "Manual touch-up layer",
    ],
    color: "#10b981",
    gradient: "from-emerald-500/20 to-emerald-900/5",
    videos: [
      {
        id: "restore-mask-pass",
        name: "04_mask-pass_cleaner.mp4",
        duration: "00:16",
        size: "22.7 MB",
        resolution: "1920×1080",
        status: "latest",
        source: VIDEO_SOURCES[1],
      },
      {
        id: "restore-tone-rebuild",
        name: "05_screentone-rebuild.mp4",
        duration: "00:21",
        size: "34.5 MB",
        resolution: "1920×1080",
        status: "ready",
        source: VIDEO_SOURCES[0],
      },
      {
        id: "restore-manual-fix",
        name: "06_manual-healing_overlay.mp4",
        duration: "00:11",
        size: "18.9 MB",
        resolution: "1920×1080",
        status: "review",
        source: VIDEO_SOURCES[1],
      },
    ],
  },
  {
    id: 2,
    icon: PenTool,
    title: "Precision Lettering",
    subtitle: "Context-aware translation meets dynamic typesetting",
    body:
      "Typesetting that respects the original layout. AI drafts translations, fits text dynamically to bubbles, and maintains visual hierarchy.",
    notes: [
      "Dynamic bubble fitting",
      "Context-aware translation",
      "Custom style presets",
    ],
    color: "#a855f7",
    gradient: "from-purple-500/20 to-purple-900/5",
    videos: [
      {
        id: "type-translation-sync",
        name: "07_translation-sync_preview.mp4",
        duration: "00:14",
        size: "20.1 MB",
        resolution: "1920×1080",
        status: "latest",
        source: VIDEO_SOURCES[0],
      },
      {
        id: "type-bubble-fit",
        name: "08_bubble-fit_pass.mp4",
        duration: "00:17",
        size: "27.8 MB",
        resolution: "1920×1080",
        status: "ready",
        source: VIDEO_SOURCES[1],
      },
      {
        id: "type-style-preset",
        name: "09_style-preset_compare.mp4",
        duration: "00:13",
        size: "19.6 MB",
        resolution: "1920×1080",
        status: "review",
        source: VIDEO_SOURCES[0],
      },
    ],
  },
  {
    id: 3,
    icon: Rocket,
    title: "One-Click Publish",
    subtitle: "QA, approve, and export release-ready files",
    body:
      "Turn the final stage into a structured release board. Side-by-side comparisons, issue tagging, and batch export in a single pass.",
    notes: [
      "Side-by-side QA board",
      "Issue tagging & comments",
      "Multi-format export",
    ],
    color: "#f43f5e",
    gradient: "from-rose-500/20 to-rose-900/5",
    videos: [
      {
        id: "publish-compare-board",
        name: "10_side-by-side_qc-board.mp4",
        duration: "00:18",
        size: "29.3 MB",
        resolution: "1920×1080",
        status: "latest",
        source: VIDEO_SOURCES[1],
      },
      {
        id: "publish-approval-pass",
        name: "11_approval-pass_release.mp4",
        duration: "00:09",
        size: "15.2 MB",
        resolution: "1920×1080",
        status: "ready",
        source: VIDEO_SOURCES[0],
      },
      {
        id: "publish-export-bundle",
        name: "12_export-bundle_done.mp4",
        duration: "00:12",
        size: "18.4 MB",
        resolution: "1920×1080",
        status: "review",
        source: VIDEO_SOURCES[1],
      },
    ],
  },
];

function statusStyles(status: WorkflowVideoFile["status"], color: string) {
  if (status === "latest") {
    return {
      label: "Latest",
      pill: {
        backgroundColor: `${color}22`,
        color,
        borderColor: `${color}44`,
      },
    };
  }

  if (status === "review") {
    return {
      label: "Review",
      pill: {
        backgroundColor: "rgba(251,191,36,0.14)",
        color: "#fbbf24",
        borderColor: "rgba(251,191,36,0.24)",
      },
    };
  }

  return {
    label: "Ready",
    pill: {
      backgroundColor: "rgba(16,185,129,0.14)",
      color: "#34d399",
      borderColor: "rgba(16,185,129,0.24)",
    },
  };
}

function WorkflowVideoPanel({ active }: { active: number }) {
  const activeStep = steps[active];
  const [selectedVideoId, setSelectedVideoId] = useState(activeStep.videos[0]?.id ?? "");

  const selectedVideo = useMemo(
    () => activeStep.videos.find((video) => video.id === selectedVideoId) ?? activeStep.videos[0],
    [activeStep, selectedVideoId],
  );

  return (
    <motion.div
      className="relative w-full max-w-[520px] overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,#0b1020_0%,#060914_100%)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)]"
      animate={{
        boxShadow: `0 0 90px 12px ${activeStep.color}12, 0 30px 80px -20px rgba(0,0,0,0.65)`,
      }}
      transition={{ duration: 0.5 }}
    >
      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:36px_36px]" />

      <div className="relative z-10 border-b border-white/8 bg-black/20 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
              <FolderOpen size={13} />
              Workflow Media Bin
            </div>
            <div className="mt-2 truncate text-sm font-semibold text-white/90">
              workflow/{activeStep.title.toLowerCase().replace(/\s+/g, "-")}/videos
            </div>
          </div>
          <div
            className="rounded-full border px-3 py-1.5 text-[10px] font-semibold"
            style={{
              color: activeStep.color,
              borderColor: `${activeStep.color}33`,
              backgroundColor: `${activeStep.color}12`,
            }}
          >
            {activeStep.videos.length} clips
          </div>
        </div>
      </div>

      <div className="relative z-10 p-5">
        <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedVideo.id}
              initial={{ opacity: 0, scale: 0.985, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.985, y: -12 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.03]"
            >
              <div className="relative aspect-video overflow-hidden bg-black">
                <video
                  key={selectedVideo.id}
                  src={selectedVideo.source}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,16,0.08)_0%,rgba(6,8,16,0.48)_100%)]" />
                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <div
                    className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                    style={{
                      color: activeStep.color,
                      borderColor: `${activeStep.color}36`,
                      backgroundColor: `${activeStep.color}18`,
                    }}
                  >
                    {activeStep.title}
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-medium text-white/70">
                    {selectedVideo.resolution}
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{selectedVideo.name}</div>
                    <div className="mt-1 text-[11px] text-white/55">{activeStep.subtitle}</div>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/14 bg-black/35 text-white shadow-lg shadow-black/30">
                    <Play size={16} className="ml-0.5" />
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Selected file
            </div>
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl border border-white/8 bg-black/18 p-3">
                <div className="flex items-center gap-2 text-white/80">
                  <Film size={13} />
                  <span className="truncate text-[11px] font-medium">{selectedVideo.name}</span>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="rounded-2xl border border-white/8 bg-black/18 px-3 py-2">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/35">
                    <Clock3 size={11} />
                    Duration
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white/85">{selectedVideo.duration}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/18 px-3 py-2">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/35">
                    <HardDrive size={11} />
                    File size
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white/85">{selectedVideo.size}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Video Files
              </div>
              <div className="mt-1 text-sm font-semibold text-white/88">
                {activeStep.title} captures
              </div>
            </div>
            <div className="rounded-full border border-white/8 bg-black/20 px-3 py-1.5 text-[10px] font-medium text-white/55">
              .mp4 assets
            </div>
          </div>

          <div className="space-y-2">
            {activeStep.videos.map((video, index) => {
              const isSelected = video.id === selectedVideo.id;
              const badge = statusStyles(video.status, activeStep.color);

              return (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => setSelectedVideoId(video.id)}
                  className={`flex w-full items-center gap-4 rounded-[20px] border px-4 py-3 text-left transition-all ${
                    isSelected
                      ? "border-white/14 bg-white/[0.06] shadow-[0_12px_30px_rgba(0,0,0,0.22)]"
                      : "border-white/8 bg-black/15 hover:border-white/12 hover:bg-white/[0.04]"
                  }`}
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: isSelected ? `${activeStep.color}18` : "rgba(255,255,255,0.04)",
                      color: isSelected ? activeStep.color : "rgba(255,255,255,0.45)",
                    }}
                  >
                    <Film size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12px] font-semibold text-white/90">
                        {video.name}
                      </span>
                      {index === 0 ? (
                        <span className="rounded-full border border-white/8 bg-white/[0.05] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/42">
                      <span>{video.resolution}</span>
                      <span>{video.duration}</span>
                      <span>{video.size}</span>
                    </div>
                  </div>

                  <div
                    className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                    style={badge.pill}
                  >
                    {badge.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function Workflow() {
  const [active, setActive] = useState(0);

  return (
    <section id="workflow" className="relative overflow-hidden py-32">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/4 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-koma-purple/5 blur-[120px]" />
        <div className="absolute right-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-koma-cyan/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeader
          badge="Workflow"
          title="From Raw Scans to Release in One Workspace"
          subtitle="Import, restore, letter, review, and export inside one production pipeline built for chapter work."
        />

        <div className="mt-20 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_520px]">
          <div className="relative space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === active;
              const colorVar = step.color;

              return (
                <motion.button
                  key={step.id}
                  onClick={() => setActive(index)}
                  className={`group relative w-full overflow-hidden rounded-3xl border text-left transition-colors duration-300 ${
                    isActive
                      ? "border-white/[0.1] bg-white/[0.04]"
                      : "border-transparent bg-transparent hover:border-white/[0.05] hover:bg-white/[0.02]"
                  }`}
                  whileTap={{ scale: 0.995 }}
                >
                  {isActive ? (
                    <motion.div
                      layoutId="activeWorkflowGlow"
                      className="absolute inset-0 opacity-30"
                      style={{
                        background: `radial-gradient(ellipse at 20% 50%, ${colorVar}15 0%, transparent 70%)`,
                      }}
                      transition={{ type: "spring", bounce: 0.2, stiffness: 150, damping: 20 }}
                    />
                  ) : null}

                  <div className="relative flex items-start gap-5 p-6">
                    <div
                      className={`relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-300 ${
                        isActive ? `bg-gradient-to-br ${step.gradient}` : "bg-white/[0.03]"
                      }`}
                    >
                      <Icon
                        size={20}
                        className={`transition-colors duration-300 ${
                          isActive ? "text-white" : "text-white/65 group-hover:text-white/85"
                        }`}
                      />
                      {isActive ? (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#050816]"
                          style={{ backgroundColor: colorVar }}
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-3">
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.2em]"
                          style={{ color: isActive ? colorVar : "rgba(214,223,255,0.72)" }}
                        >
                          Step 0{index + 1}
                        </span>
                        {isActive ? (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                          >
                            <ChevronRight size={12} style={{ color: colorVar }} />
                          </motion.div>
                        ) : null}
                      </div>
                      <h3
                        className={`text-lg font-semibold transition-colors duration-300 ${
                          isActive ? "text-white" : "text-white/70 group-hover:text-white/90"
                        }`}
                      >
                        {step.title}
                      </h3>
                      <p
                        className={`mt-0.5 text-sm transition-colors duration-300 ${
                          isActive ? "text-white/70" : "text-white/65"
                        }`}
                      >
                        {step.subtitle}
                      </p>

                      <AnimatePresence initial={false}>
                        {isActive ? (
                          <motion.div
                            initial="collapsed"
                            animate="open"
                            exit="collapsed"
                            variants={{
                              open: { opacity: 1, height: "auto", marginTop: 16 },
                              collapsed: { opacity: 0, height: 0, marginTop: 0 },
                            }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <p className="text-sm leading-relaxed text-white/40">{step.body}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {step.notes.map((note) => (
                                <span
                                  key={note}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/50"
                                >
                                  <span className="h-1 w-1 rounded-full" style={{ backgroundColor: colorVar }} />
                                  {note}
                                </span>
                              ))}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="relative flex items-center justify-center">
            <motion.div
              className="relative w-full"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <WorkflowVideoPanel key={active} active={active} />
            </motion.div>

            <div className="absolute -right-8 -top-8 hidden h-16 w-16 rotate-12 rounded-3xl border border-white/5 lg:block" />
            <div className="absolute -bottom-6 -left-6 hidden h-24 w-24 rounded-full border border-white/5 lg:block" />
          </div>
        </div>
      </div>
    </section>
  );
}
