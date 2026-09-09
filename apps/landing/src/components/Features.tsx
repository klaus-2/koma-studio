"use client";

import { motion } from "framer-motion";
import {
  Languages,
  Paintbrush,
  Type,
  PenTool,
  FolderOpen,
  ShieldCheck,
  HardDrive,
  Blocks,
} from "lucide-react";
import { SectionHeader } from "./ui/SectionHeader";

const FEATURES = [
  {
    id: "translate",
    icon: Languages,
    title: "AI Translation",
    description:
      "Bring your own model. K\u014cMA talks to OpenAI, Anthropic, Gemini, or any OpenAI-compatible endpoint \u2014 including local models \u2014 so no provider can lock your chapters behind a paywall.",
    details: [
      "Bubble detection & OCR",
      "Provider-agnostic model layer",
      "Glossary & terminology memory",
      "Batch translate entire volumes",
    ],
    color: "from-purple-500/20 to-purple-600/5",
    border: "hover:border-purple-500/30",
    iconColor: "text-purple-400",
    iconSurface:
      "bg-koma-purple/[0.08] border-koma-purple/[0.12] group-hover:bg-koma-purple/[0.15] group-hover:border-koma-purple/30 group-hover:shadow-glow-sm",
    hoverGlow:
      "radial-gradient(circle at 70% 30%, rgba(168,85,247,0.5) 0%, transparent 50%)",
    bulletColor: "bg-koma-purple/60",
    frameClass:
      "group-hover:border-koma-purple/20 group-hover:bg-white/[0.04] group-hover:shadow-[0_0_0_1px_rgba(168,85,247,0.16),0_24px_60px_rgba(0,0,0,0.32)]",
    frameOverlay: "group-hover:border-koma-purple/25",
  },
  {
    id: "clean",
    icon: Paintbrush,
    title: "Smart Cleaning",
    description:
      "AI-powered inpainting removes text, SFX, and artifacts while preserving artwork detail with one click \u2014 and you choose which model does the work.",
    details: [
      "Neural inpainting engine",
      "SFX detection & removal",
      "Background reconstruction",
      "Manual mask refinement",
    ],
    color: "from-cyan-500/20 to-cyan-600/5",
    border: "hover:border-cyan-500/30",
    iconColor: "text-cyan-400",
    iconSurface:
      "bg-koma-cyan/[0.08] border-koma-cyan/[0.12] group-hover:bg-koma-cyan/[0.15] group-hover:border-koma-cyan/30 group-hover:shadow-glow-cyan",
    hoverGlow:
      "radial-gradient(circle at 30% 70%, rgba(6,182,212,0.5) 0%, transparent 50%)",
    bulletColor: "bg-koma-cyan/60",
    frameClass:
      "group-hover:border-koma-cyan/20 group-hover:bg-white/[0.04] group-hover:shadow-[0_0_0_1px_rgba(6,182,212,0.16),0_24px_60px_rgba(0,0,0,0.32)]",
    frameOverlay: "group-hover:border-koma-cyan/25",
  },
  {
    id: "typeset",
    icon: Type,
    title: "Auto Typesetting",
    description:
      "Intelligent text placement with auto-sizing, font matching, and bubble-aware formatting \u2014 your fonts, your rules, no export restrictions.",
    details: [
      "Smart bubble fitting",
      "Font style detection",
      "Vertical & horizontal text",
      "Custom font library",
    ],
    color: "from-emerald-500/20 to-emerald-600/5",
    border: "hover:border-emerald-500/30",
    iconColor: "text-emerald-400",
    iconSurface:
      "bg-emerald-400/[0.08] border-emerald-400/[0.12] group-hover:bg-emerald-400/[0.15] group-hover:border-emerald-400/30 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.22)]",
    hoverGlow:
      "radial-gradient(circle at 65% 35%, rgba(16,185,129,0.45) 0%, transparent 52%)",
    bulletColor: "bg-emerald-400/60",
    frameClass:
      "group-hover:border-emerald-400/20 group-hover:bg-white/[0.04] group-hover:shadow-[0_0_0_1px_rgba(16,185,129,0.16),0_24px_60px_rgba(0,0,0,0.32)]",
    frameOverlay: "group-hover:border-emerald-400/25",
  },
  {
    id: "redraw",
    icon: PenTool,
    title: "AI Redraw",
    description:
      "Reconstruct art behind removed text with AI that understands manga art styles and patterns \u2014 swap in your own model or fine-tune the defaults.",
    details: [
      "Style-aware generation",
      "Seamless blending",
      "Pattern continuation",
      "Manual touch-up tools",
    ],
    color: "from-amber-500/20 to-amber-600/5",
    border: "hover:border-amber-500/30",
    iconColor: "text-amber-400",
    iconSurface:
      "bg-amber-400/[0.08] border-amber-400/[0.12] group-hover:bg-amber-400/[0.15] group-hover:border-amber-400/30 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]",
    hoverGlow:
      "radial-gradient(circle at 35% 65%, rgba(245,158,11,0.4) 0%, transparent 52%)",
    bulletColor: "bg-amber-400/60",
    frameClass:
      "group-hover:border-amber-400/20 group-hover:bg-white/[0.04] group-hover:shadow-[0_0_0_1px_rgba(245,158,11,0.14),0_24px_60px_rgba(0,0,0,0.32)]",
    frameOverlay: "group-hover:border-amber-400/25",
  },
  {
    id: "raw-manager",
    icon: FolderOpen,
    title: "Raw Manager",
    description:
      "Import, organize, and batch-process entire manga volumes with smart naming and chapter detection. Files stay on your disk, in a format you can inspect.",
    details: [
      "Drag & drop import",
      "Auto chapter detection",
      "Batch rename & organize",
      "Multi-series management",
    ],
    color: "from-rose-500/20 to-rose-600/5",
    border: "hover:border-rose-500/30",
    iconColor: "text-rose-400",
    iconSurface:
      "bg-rose-400/[0.08] border-rose-400/[0.12] group-hover:bg-rose-400/[0.15] group-hover:border-rose-400/30 group-hover:shadow-[0_0_20px_rgba(244,63,94,0.18)]",
    hoverGlow:
      "radial-gradient(circle at 70% 30%, rgba(244,63,94,0.4) 0%, transparent 50%)",
    bulletColor: "bg-rose-400/60",
    frameClass:
      "group-hover:border-rose-400/20 group-hover:bg-white/[0.04] group-hover:shadow-[0_0_0_1px_rgba(244,63,94,0.14),0_24px_60px_rgba(0,0,0,0.32)]",
    frameOverlay: "group-hover:border-rose-400/25",
  },
  {
    id: "qc",
    icon: ShieldCheck,
    title: "Quality Control",
    description:
      "Built-in QC pipeline to review, approve, and track every page before publishing \u2014 with review state stored alongside your project files.",
    details: [
      "Side-by-side comparison",
      "Issue tagging system",
      "Review workflow",
      "Export-ready validation",
    ],
    color: "from-violet-500/20 to-violet-600/5",
    border: "hover:border-violet-500/30",
    iconColor: "text-violet-400",
    iconSurface:
      "bg-violet-400/[0.08] border-violet-400/[0.12] group-hover:bg-violet-400/[0.15] group-hover:border-violet-400/30 group-hover:shadow-[0_0_20px_rgba(167,139,250,0.2)]",
    hoverGlow:
      "radial-gradient(circle at 32% 68%, rgba(167,139,250,0.45) 0%, transparent 52%)",
    bulletColor: "bg-violet-400/60",
    frameClass:
      "group-hover:border-violet-400/20 group-hover:bg-white/[0.04] group-hover:shadow-[0_0_0_1px_rgba(167,139,250,0.15),0_24px_60px_rgba(0,0,0,0.32)]",
    frameOverlay: "group-hover:border-violet-400/25",
  },
  {
    id: "local-first",
    icon: HardDrive,
    title: "Local-First & Private",
    description:
      "Your chapters, your machine. Projects live on disk, the app runs without an account, and there is no usage telemetry phoning home.",
    details: [
      "No account or license server",
      "Works with local models offline",
      "Projects stored on your disk",
      "Zero usage tracking",
    ],
    color: "from-sky-500/20 to-sky-600/5",
    border: "hover:border-sky-500/30",
    iconColor: "text-sky-400",
    iconSurface:
      "bg-sky-400/[0.08] border-sky-400/[0.12] group-hover:bg-sky-400/[0.15] group-hover:border-sky-400/30 group-hover:shadow-[0_0_20px_rgba(56,189,248,0.2)]",
    hoverGlow:
      "radial-gradient(circle at 30% 70%, rgba(56,189,248,0.45) 0%, transparent 52%)",
    bulletColor: "bg-sky-400/60",
    frameClass:
      "group-hover:border-sky-400/20 group-hover:bg-white/[0.04] group-hover:shadow-[0_0_0_1px_rgba(56,189,248,0.15),0_24px_60px_rgba(0,0,0,0.32)]",
    frameOverlay: "group-hover:border-sky-400/25",
  },
  {
    id: "extensible",
    icon: Blocks,
    title: "Extensible by Design",
    description:
      "Read the source, change the pipeline, ship a plugin. K\u014cMA is MIT-licensed end to end \u2014 no feature is held back for a paid tier.",
    details: [
      "Open project & export formats",
      "Plugin and script hooks",
      "Fork, patch, self-host",
      "MIT \u2014 no paywalled features",
    ],
    color: "from-fuchsia-500/20 to-fuchsia-600/5",
    border: "hover:border-fuchsia-500/30",
    iconColor: "text-fuchsia-400",
    iconSurface:
      "bg-fuchsia-400/[0.08] border-fuchsia-400/[0.12] group-hover:bg-fuchsia-400/[0.15] group-hover:border-fuchsia-400/30 group-hover:shadow-[0_0_20px_rgba(232,121,249,0.2)]",
    hoverGlow:
      "radial-gradient(circle at 68% 32%, rgba(232,121,249,0.45) 0%, transparent 52%)",
    bulletColor: "bg-fuchsia-400/60",
    frameClass:
      "group-hover:border-fuchsia-400/20 group-hover:bg-white/[0.04] group-hover:shadow-[0_0_0_1px_rgba(232,121,249,0.15),0_24px_60px_rgba(0,0,0,0.32)]",
    frameOverlay: "group-hover:border-fuchsia-400/25",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

export function Features() {
  return (
    <section id="features" className="relative py-[var(--spacing-section)] overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          badge="Features"
          title="Everything You Need for Professional Scanlation"
          subtitle="One workspace for the whole chapter \u2014 and every line of it is MIT-licensed, auditable, and yours to modify."
        />

        <motion.div
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5 }}
                className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] glass-card p-6 transition-all duration-300 hover:-translate-y-1 ${feat.border} ${feat.frameClass}`}
              >
                <div
                  className={`pointer-events-none absolute inset-0 rounded-2xl border border-transparent opacity-0 transition-all duration-300 group-hover:opacity-100 ${feat.frameOverlay}`}
                />

                <div className="absolute top-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-koma-purple to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-[0.03]">
                  <div
                    className="h-full w-full"
                    style={{ backgroundImage: feat.hoverGlow }}
                  />
                </div>

                <div
                  className={`relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300 ${feat.iconSurface}`}
                >
                  <Icon size={22} className={feat.iconColor} />
                </div>

                <h3 className="font-[var(--font-display)] text-lg font-semibold text-koma-text mb-2">
                  {feat.title}
                </h3>
                <p className="text-sm leading-relaxed text-koma-text-secondary mb-4">
                  {feat.description}
                </p>

                {/* Detail bullets */}
                <ul className="space-y-1.5">
                  {feat.details.map((d) => (
                    <li
                      key={d}
                      className="flex items-center gap-2 text-xs text-koma-muted"
                    >
                      <span className={`h-1 w-1 rounded-full ${feat.bulletColor}`} />
                      {d}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
