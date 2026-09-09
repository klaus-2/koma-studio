import { type ReactNode } from "react";
import {
  BookOpen,
  ChevronDown,
  Eraser,
  Eye,
  Languages,
  Layers,
  Paintbrush,
  Search,
  SearchCheck,
  Sparkles,
  Type,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type AppModeId = "aio" | "translator" | "typesetter" | "cleaner" | "redraw" | "qc";
export type DemoState = "idle" | "running" | "finished";
export type PipelineStepId = "detect" | "ocr" | "translate" | "segment" | "clean" | "render";

export interface AppMode {
  id: AppModeId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export interface PreviewAsset {
  before: string;
  after: string;
  fileName: string;
  fileDims: string;
  chapterLabel: string;
}

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  shortLabel: string;
  detail: string;
  icon: LucideIcon;
  accentClass: string;
  fillClass: string;
  glowClass: string;
  model: string;
  durationMs: number;
}

export interface TimelineStep extends PipelineStep {
  index: number;
  startMs: number;
  endMs: number;
}

export interface StageOverlayProps {
  step: TimelineStep;
  stepProgress: number;
  pipelineProgress: number;
  revealProgress: number;
}

export interface ModeDemoConfig {
  panelTitle: string;
  modePrimaryPill: string;
  modeSecondaryPill: string;
  runLabel: string;
  runningLabel: string;
  idleHint: string;
  doneHint: string;
  inspectorLabel: string;
  inspectorValue: string;
  showLanguages: boolean;
  sourceLanguage?: string;
  targetLanguage?: string;
  steps: PipelineStep[];
}

export const APP_MODES = [
  { id: "aio", label: "All-in-One", shortLabel: "AIO", icon: Zap },
  { id: "translator", label: "Translator", shortLabel: "Trans", icon: Languages },
  { id: "typesetter", label: "Typesetter", shortLabel: "Type", icon: Type },
  { id: "cleaner", label: "Cleaner", shortLabel: "Clean", icon: Sparkles },
  { id: "redraw", label: "Redraw", shortLabel: "Redraw", icon: Paintbrush },
  { id: "qc", label: "QC Check", shortLabel: "QC", icon: SearchCheck },
] as const satisfies readonly AppMode[];

export const PREVIEW_ASSETS: Record<AppModeId, PreviewAsset> = {
  aio: {
    before: "/app-preview/translate-before.webp",
    after: "/app-preview/translate-after.webp",
    fileName: "g-page-01.png",
    fileDims: "800×10494",
    chapterLabel: "Chapter 12 · AIO automatic",
  },
  translator: {
    before: "/app-preview/translate-before.webp",
    after: "/app-preview/translate-after.webp",
    fileName: "translate-preview.png",
    fileDims: "800×10494",
    chapterLabel: "Translator workspace",
  },
  typesetter: {
    before: "/app-preview/translate-before.webp",
    after: "/app-preview/translate-after.webp",
    fileName: "typeset-preview.png",
    fileDims: "800×10494",
    chapterLabel: "Typesetter canvas",
  },
  cleaner: {
    before: "/app-preview/clean-before.webp",
    after: "/app-preview/clean-after.webp",
    fileName: "clean-preview.png",
    fileDims: "1350×1920",
    chapterLabel: "Cleaner pass",
  },
  redraw: {
    before: "/app-preview/redraw-before.webp",
    after: "/app-preview/redraw-after.webp",
    fileName: "redraw-preview.png",
    fileDims: "1350×1920",
    chapterLabel: "Redraw assist",
  },
  qc: {
    before: "/app-preview/aio-before.webp",
    after: "/app-preview/aio-after.webp",
    fileName: "qc-preview.png",
    fileDims: "1350×1920",
    chapterLabel: "QC compare",
  },
};

export const PIPELINE_STEPS = [
  {
    id: "detect",
    label: "Detect",
    shortLabel: "Detect text regions",
    detail: "Balloon, narration, and SFX anchors are mapped before any text is touched.",
    icon: Search,
    accentClass: "text-cyan-300",
    fillClass: "bg-cyan-300",
    glowClass: "shadow-[0_0_32px_rgba(34,211,238,0.22)]",
    model: "RT-DETR v2 (ONNX)",
    durationMs: 1200,
  },
  {
    id: "ocr",
    label: "OCR",
    shortLabel: "Recognize source copy",
    detail: "OCR locks Japanese text into editable tokens with reading order preserved.",
    icon: Eye,
    accentClass: "text-violet-300",
    fillClass: "bg-violet-300",
    glowClass: "shadow-[0_0_32px_rgba(196,181,253,0.2)]",
    model: "PaddleOCR JP",
    durationMs: 1120,
  },
  {
    id: "translate",
    label: "Translate",
    shortLabel: "Draft translated dialogue",
    detail: "The translation stage drafts PT-BR copy and keeps bubble context intact.",
    icon: Languages,
    accentClass: "text-fuchsia-300",
    fillClass: "bg-fuchsia-300",
    glowClass: "shadow-[0_0_32px_rgba(244,114,182,0.2)]",
    model: "KOMA Translate Memory",
    durationMs: 1280,
  },
  {
    id: "segment",
    label: "Segment",
    shortLabel: "Link text to regions",
    detail: "Segments connect translated lines to the exact balloon groups that will receive them.",
    icon: Wand2,
    accentClass: "text-emerald-300",
    fillClass: "bg-emerald-300",
    glowClass: "shadow-[0_0_32px_rgba(52,211,153,0.2)]",
    model: "Balloon Graph v4",
    durationMs: 1080,
  },
  {
    id: "clean",
    label: "Clean",
    shortLabel: "Restore artwork",
    detail: "Cleanup removes source lettering while rebuilding linework and screentones.",
    icon: Eraser,
    accentClass: "text-sky-300",
    fillClass: "bg-sky-300",
    glowClass: "shadow-[0_0_32px_rgba(125,211,252,0.18)]",
    model: "KOMA Clean v3",
    durationMs: 1180,
  },
  {
    id: "render",
    label: "Render",
    shortLabel: "Typeset final page",
    detail: "Typesetting lands translated copy back into the page and prepares the release-ready result.",
    icon: Paintbrush,
    accentClass: "text-amber-300",
    fillClass: "bg-amber-300",
    glowClass: "shadow-[0_0_32px_rgba(251,191,36,0.18)]",
    model: "CC Wild Words Preset",
    durationMs: 1320,
  },
] as const satisfies readonly PipelineStep[];

export const LEFT_STATS = [
  { label: "Today", value: "0", hint: "Resets in 9h 13m" },
  { label: "This week", value: "0", hint: "Resets in 153h 13m" },
  { label: "This month", value: "192", hint: "Resets in 471h 13m" },
] as const;

export const TOPBAR_MENUS = [
  { label: "Organize", icon: Layers, active: false, compact: false },
  { label: "AIO", icon: Zap, active: true, compact: true },
  { label: "Production", icon: Paintbrush, active: false, compact: false },
  { label: "Utilities", icon: Wand2, active: false, compact: false },
  { label: "Information", icon: BookOpen, active: false, compact: false },
] as const;

export const TOOL_STRIP = [
  { icon: Search, active: true },
  { icon: Eye, active: true },
  { icon: Languages, active: true },
  { icon: Wand2, active: true },
  { icon: Eraser, active: true },
  { icon: Paintbrush, active: true },
] as const;

export const CALL_OUTS = [
  { icon: Zap, label: "AIO automatic / manual", desc: "The landing mock now mirrors the same AIO split from the desktop app." },
  { icon: Languages, label: "Real language routing", desc: "Japanese → Portuguese sits in the panel exactly where users expect it." },
  { icon: Layers, label: "Workspace-first UI", desc: "Left stats, center canvas, and the right tools rail follow the real Koma layout." },
  { icon: Sparkles, label: "Deterministic pipeline demo", desc: "The pipeline no longer leaks the final result before the animation completes." },
] as const;

export const FINAL_REVEAL_MS = 760;
export const FINAL_HOLD_MS = 900;

const STEP_PRESETS = {
  detect: PIPELINE_STEPS[0],
  ocr: PIPELINE_STEPS[1],
  translate: PIPELINE_STEPS[2],
  segment: PIPELINE_STEPS[3],
  clean: PIPELINE_STEPS[4],
  render: PIPELINE_STEPS[5],
} as const;

function makeStep(id: keyof typeof STEP_PRESETS, overrides?: Partial<PipelineStep>): PipelineStep {
  return {
    ...STEP_PRESETS[id],
    ...overrides,
  };
}

export const MODE_DEMO_CONFIGS: Record<AppModeId, ModeDemoConfig> = {
  aio: {
    panelTitle: "AIO – All-in-One",
    modePrimaryPill: "AIO automatic",
    modeSecondaryPill: "AIO manual",
    runLabel: "Run AIO",
    runningLabel: "Running AIO",
    idleHint: "The original page stays visible while the pipeline prepares the final render.",
    doneHint: "The final canvas is visible only after the last stage and reveal complete.",
    inspectorLabel: "Detect text",
    inspectorValue: STEP_PRESETS.detect.model,
    showLanguages: true,
    sourceLanguage: "Japanese",
    targetLanguage: "Portuguese",
    steps: [...PIPELINE_STEPS],
  },
  translator: {
    panelTitle: "Translator – Language Pass",
    modePrimaryPill: "Translator live",
    modeSecondaryPill: "Glossary memory",
    runLabel: "Run Translator",
    runningLabel: "Translating",
    idleHint: "Translator mode previews the original page until OCR and translation finish.",
    doneHint: "The translated page appears only after the translator flow completes.",
    inspectorLabel: "Translation engine",
    inspectorValue: STEP_PRESETS.translate.model,
    showLanguages: true,
    sourceLanguage: "Japanese",
    targetLanguage: "Portuguese",
    steps: [
      makeStep("detect", {
        durationMs: 950,
        detail: "Translator mode first maps text regions so dialogue order survives the OCR pass.",
      }),
      makeStep("ocr", {
        durationMs: 1100,
        detail: "OCR extracts source copy into editable lines before translation starts.",
      }),
      makeStep("translate", {
        durationMs: 1500,
        label: "Translate",
        shortLabel: "Draft translated dialogue",
        detail: "The translator flow drafts Portuguese dialogue and keeps line grouping stable.",
      }),
    ],
  },
  typesetter: {
    panelTitle: "Typesetter – Balloon Layout",
    modePrimaryPill: "Typesetter live",
    modeSecondaryPill: "Manual kerning",
    runLabel: "Run Typesetter",
    runningLabel: "Typesetting",
    idleHint: "Typesetter mode keeps the original source visible until bubble fitting is finished.",
    doneHint: "The composed page only lands after the final typography pass completes.",
    inspectorLabel: "Text preset",
    inspectorValue: "CC Wild Words Preset",
    showLanguages: false,
    steps: [
      makeStep("segment", {
        durationMs: 980,
        label: "Map",
        shortLabel: "Map balloons to copy",
        detail: "Typesetter mode links translated lines to balloon groups before placing text.",
        model: "Bubble Fit Grid",
      }),
      makeStep("render", {
        durationMs: 1380,
        label: "Typeset",
        shortLabel: "Fit text into balloons",
        detail: "Typography is fitted back into the page with manga-aware spacing and hierarchy.",
        model: "CC Wild Words Preset",
      }),
      makeStep("render", {
        durationMs: 980,
        label: "Polish",
        shortLabel: "Balance final text layout",
        detail: "The final pass tightens spacing, tails, and alignment before showing the result.",
        model: "Final Balloon Balance",
      }),
    ],
  },
  cleaner: {
    panelTitle: "Cleaner – Restoration Pass",
    modePrimaryPill: "Cleaner live",
    modeSecondaryPill: "Manual patch",
    runLabel: "Run Cleaner",
    runningLabel: "Cleaning",
    idleHint: "Cleaner mode holds on the original page until the cleanup pass actually finishes.",
    doneHint: "The cleaned page appears only after the restoration step is done.",
    inspectorLabel: "Cleanup model",
    inspectorValue: STEP_PRESETS.clean.model,
    showLanguages: false,
    steps: [
      makeStep("detect", {
        durationMs: 820,
        label: "Mask",
        shortLabel: "Find removable text",
        detail: "Cleaner mode isolates source lettering before reconstructing the panel art.",
        model: "Removal Mask Detect",
      }),
      makeStep("clean", {
        durationMs: 1680,
        label: "Clean",
        shortLabel: "Restore background artwork",
        detail: "The cleanup pass removes text and rebuilds linework, screentones, and texture.",
      }),
    ],
  },
  redraw: {
    panelTitle: "Redraw – Inpaint Assist",
    modePrimaryPill: "Redraw assist",
    modeSecondaryPill: "Brush refine",
    runLabel: "Run Redraw",
    runningLabel: "Redrawing",
    idleHint: "Redraw mode keeps the untouched source visible until the inpaint pass is complete.",
    doneHint: "The restored redraw result is revealed only after the final blend finishes.",
    inspectorLabel: "Redraw model",
    inspectorValue: "KOMA Redraw v2",
    showLanguages: false,
    steps: [
      makeStep("detect", {
        durationMs: 920,
        label: "Mask",
        shortLabel: "Mark damaged region",
        detail: "Redraw mode identifies the damaged area that needs reconstruction.",
        model: "Damage Region Detect",
      }),
      makeStep("clean", {
        durationMs: 1240,
        label: "Inpaint",
        shortLabel: "Rebuild missing art",
        detail: "The redraw pass reconstructs missing linework and nearby texture.",
        model: "KOMA Redraw v2",
      }),
      makeStep("render", {
        durationMs: 980,
        label: "Blend",
        shortLabel: "Blend redraw into panel",
        detail: "The result is blended back into the page so the redraw feels native to the art.",
        model: "Panel Blend Finish",
      }),
    ],
  },
  qc: {
    panelTitle: "QC Check – Review Flow",
    modePrimaryPill: "QC checklist",
    modeSecondaryPill: "Release notes",
    runLabel: "Run QC",
    runningLabel: "Reviewing",
    idleHint: "QC mode keeps the source visible until the review flow reaches approval.",
    doneHint: "The approved review state appears only after compare and sign-off complete.",
    inspectorLabel: "QC profile",
    inspectorValue: "Release Checklist v3",
    showLanguages: false,
    steps: [
      makeStep("ocr", {
        durationMs: 860,
        label: "Inspect",
        shortLabel: "Inspect translated copy",
        detail: "QC starts by checking translated copy against detected dialogue regions.",
        model: "Dialogue Review Lens",
      }),
      makeStep("segment", {
        durationMs: 920,
        label: "Compare",
        shortLabel: "Compare source and final",
        detail: "Side-by-side comparison flags spacing, tails, and misplaced text before sign-off.",
        model: "Diff Review Matrix",
      }),
      makeStep("render", {
        durationMs: 760,
        label: "Approve",
        shortLabel: "Approve release state",
        detail: "The release checklist is signed off and the approved state becomes visible at the end.",
        model: "Release Checklist v3",
      }),
    ],
  },
};

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function PanelSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-white/7 bg-[#0d1120]/84 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-koma-text-secondary/80">
          {title}
        </div>
        {badge ? (
          <span className="rounded-full border border-koma-purple/18 bg-koma-purple/12 px-2 py-1 text-[9px] font-semibold text-koma-purple-light">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function SelectField({ value }: { value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-koma-text-secondary">
      <span>{value}</span>
      <ChevronDown size={12} className="text-koma-muted" />
    </div>
  );
}

export function TopbarIconButton({
  icon: Icon,
  label,
  active,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "flex h-8 w-8 items-center justify-center rounded-xl border text-koma-muted transition-colors",
        active
          ? "border-koma-purple/16 bg-koma-purple/10 text-koma-purple-light"
          : "border-white/6 bg-black/20 hover:text-koma-text-secondary",
      )}
    >
      <Icon size={13} />
    </button>
  );
}

export function PipelineTile({
  step,
  isActive,
  isComplete,
}: {
  step: TimelineStep;
  isActive: boolean;
  isComplete: boolean;
}) {
  const Icon = step.icon;

  return (
    <div
      className={cx(
        "relative rounded-[18px] border px-3 py-3 transition-all",
        isActive
          ? `border-white/15 bg-white/[0.05] ${step.glowClass}`
          : isComplete
            ? "border-emerald-400/18 bg-emerald-400/8"
            : "border-white/7 bg-black/18",
      )}
    >
      <span
        className={cx(
          "absolute right-2 top-2 h-2.5 w-2.5 rounded-full",
          isComplete ? "bg-emerald-400" : isActive ? step.fillClass : "bg-white/10",
        )}
      />
      <div
        className={cx(
          "mb-3 flex h-8 w-8 items-center justify-center rounded-xl border",
          isActive
            ? "border-white/10 bg-white/[0.05]"
            : isComplete
              ? "border-emerald-400/15 bg-emerald-400/8"
              : "border-white/6 bg-white/[0.02]",
        )}
      >
        <Icon size={14} className={cx(isComplete ? "text-emerald-300" : isActive ? step.accentClass : "text-koma-muted")} />
      </div>
      <div className={cx("text-[11px] font-semibold", isActive || isComplete ? "text-koma-text" : "text-koma-text-secondary")}>
        {step.label}
      </div>
      <div className="mt-1 text-[10px] leading-4 text-koma-muted">{step.model}</div>
    </div>
  );
}

export function FooterBar({
  mode,
  demoState,
  currentStep,
}: {
  mode: AppModeId;
  demoState: DemoState;
  currentStep: TimelineStep;
}) {
  const modeLabel = APP_MODES.find((item) => item.id === mode)?.label ?? "All-in-One";

  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-t border-white/6 bg-[#060913]/96 px-4 text-[9px] font-mono text-koma-muted">
      <div className="flex items-center gap-2">
        <span>Mode: {modeLabel}</span>
        <span>·</span>
        <span>Preview canvas</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cx(
            "rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]",
            demoState === "running"
              ? `${currentStep.accentClass} border-white/10 bg-white/[0.03]`
              : demoState === "finished"
                ? "border-emerald-400/18 bg-emerald-400/10 text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-koma-text-secondary",
          )}
        >
          {demoState === "running" ? currentStep.label : demoState === "finished" ? "Rendered" : "Pending"}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-koma-muted">
          Legacy
        </span>
      </div>
    </div>
  );
}
