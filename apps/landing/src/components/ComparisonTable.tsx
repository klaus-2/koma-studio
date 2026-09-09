"use client";

import Link from "next/link";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  Check,
  X,
  ArrowUpRight,
  Sparkles,
  Gauge,
  Lock,
  AlertTriangle,
  BookOpen,
  Flame,
} from "lucide-react";
import { SectionHeader } from "./ui/SectionHeader";
import { useRef, type MouseEvent } from "react";

/* ═══════════════════════ DATA ═══════════════════════ */

const matrix = [
  {
    label: "Translation + cleanup + lettering + redraw",
    koma: "Included in one app — MIT, no tier gating",
    alt: "Usually split across quota-backed tools or paid unlocks",
  },
  {
    label: "Cost model",
    koma: "Free forever; you only pay the model provider you choose",
    alt: "Credits, seats, or page packs that run out mid-chapter",
  },
  {
    label: "Where your pages are processed",
    koma: "On your machine — model calls go to the provider you pick",
    alt: "Uploaded to someone else's servers by default",
  },
  {
    label: "Ability to inspect or change behaviour",
    koma: "Read the source, patch it, build your own release",
    alt: "Closed source — you get whatever the vendor ships",
  },
  {
    label: "What happens if the product is discontinued",
    koma: "Fork it and keep using it forever",
    alt: "Access ends, and your workflow goes with it",
  },
];

type Status = "metered" | "gated" | "limited";

interface Alternative {
  name: string;
  href: string;
  summary: string;
  pricing?: string;
  status?: Status;
}

const alternatives: Alternative[] = [
  {
    name: "Comic Translator",
    href: "/comictranslator-vs-koma-studio",
    summary: "Translation-first option for fast comic image translation.",
    pricing: "Paid subscription + credits",
    status: "metered",
  },
  {
    name: "Adobe Photoshop",
    href: "/photoshop-vs-koma-studio",
    summary: "Powerful for manual art work, but not a purpose-built scanlation OS.",
    pricing: "Subscription required",
    status: "gated",
  },
  {
    name: "AI Manga Translate",
    href: "/aimangatranslate-vs-koma-studio",
    summary: "AI-powered manga translation with volume tied to packs or credits.",
    pricing: "Paid packs + subscription",
    status: "metered",
  },
  {
    name: "Mangaday",
    href: "/mangaday-vs-koma-studio",
    summary: "Daily free credits, but higher-volume features behind paid tiers.",
    pricing: "Free quota → paid plans",
    status: "gated",
  },
  {
    name: "Yomu AI",
    href: "/yomu-vs-koma-studio",
    summary: "Recurring credit-based plans for manga translation usage.",
    pricing: "Subscription + credit allotments",
    status: "gated",
  },
  {
    name: "Transmonkey",
    href: "/transmonkey-vs-koma-studio",
    summary: "Free usage capped; unlimited access requires a paid upgrade.",
    pricing: "Free cap → upgrade",
    status: "limited",
  },
];

/* ═══════════════════ STATUS CONFIG ═══════════════════ */

const statusConfig: Record<
  Status,
  { label: string; Icon: typeof Gauge; color: string; bg: string; border: string; bar: string }
> = {
  metered: {
    label: "Metered",
    Icon: Gauge,
    color: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    bar: "bg-amber-400/40",
  },
  gated: {
    label: "Gated",
    Icon: Lock,
    color: "text-orange-300",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    bar: "bg-orange-400/40",
  },
  limited: {
    label: "Limited",
    Icon: AlertTriangle,
    color: "text-rose-300",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    bar: "bg-rose-400/40",
  },
};

/* ═══════════════════ TILT CARD ═══════════════════ */

function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(my, [0, 1], [4, -4]), { stiffness: 280, damping: 24 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-4, 4]), { stiffness: 280, damping: 24 });

  function onMove(e: MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }

  function onLeave() {
    mx.set(0.5);
    my.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════ DECORATIONS ═══════════════════ */

function HalftoneOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-30"
      aria-hidden
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(168,85,247,0.05) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    />
  );
}

function PanelCorners({ color = "rgba(16,185,129,0.18)" }: { color?: string }) {
  const s = "h-4 w-4";
  return (
    <>
      <span className={`absolute left-3 top-3 ${s} border-l-2 border-t-2 rounded-tl-sm`} style={{ borderColor: color }} />
      <span className={`absolute right-3 top-3 ${s} border-r-2 border-t-2 rounded-tr-sm`} style={{ borderColor: color }} />
      <span className={`absolute bottom-3 left-3 ${s} border-b-2 border-l-2 rounded-bl-sm`} style={{ borderColor: color }} />
      <span className={`absolute bottom-3 right-3 ${s} border-b-2 border-r-2 rounded-br-sm`} style={{ borderColor: color }} />
    </>
  );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */

export function ComparisonTable() {
  return (
    <section id="compare" className="relative overflow-hidden py-[var(--spacing-section)]">
      <HalftoneOverlay />

      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -left-48 top-1/4 h-[520px] w-[520px] rounded-full bg-emerald-500/[0.07] blur-[140px]" />
      <div className="pointer-events-none absolute -right-48 bottom-1/4 h-[440px] w-[440px] rounded-full bg-purple-500/[0.07] blur-[140px]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-cyan-500/[0.04] blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeader
          badge="Open source vs. hosted tools"
          title="Your Chapters Shouldn't Depend on a Credit Balance"
          subtitle="Most manga translation tools are closed SaaS: metered pages, capped free tiers, and files you cannot inspect the fate of. KŌMA runs on your machine under the MIT license — bring your own model, keep your own files."
        />

        {/* ────────── GRID ────────── */}
        <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_380px]">
          {/* ═══ LEFT: COMPARISON PANEL ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025] shadow-[0_8px_60px_rgba(0,0,0,0.3)] backdrop-blur-2xl"
          >
            <PanelCorners />

            {/* ── Header ── */}
            <div className="relative overflow-hidden border-b border-white/[0.06] px-8 py-8">
              {/* Ink-wash gradient */}
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.14)_0%,rgba(168,85,247,0.10)_50%,rgba(6,182,212,0.06)_100%)]" />

              {/* Speed-line decoration */}
              <div
                className="absolute right-0 top-0 h-full w-28 opacity-[0.07]"
                style={{
                  background:
                    "repeating-linear-gradient(-45deg,transparent,transparent 3px,rgba(255,255,255,0.4) 3px,rgba(255,255,255,0.4) 4px)",
                }}
              />

              <div className="relative">
                <div className="mb-4 inline-flex items-center gap-2.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300 backdrop-blur-sm">
                  <Sparkles size={11} className="text-emerald-400" />
                  KŌMA vs pieced-together stacks
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-white">
                  The full workflow stays open.
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45">
                  Translation, cleanup, lettering, redraw, QA, and chapter flow — all in one
                  desktop-native workspace. You shouldn&apos;t need a pricing maze just to finish a
                  chapter cleanly.
                </p>
              </div>
            </div>

            {/* ── Column Headers ── */}
            <div className="hidden border-b border-white/[0.04] px-8 py-3.5 md:grid md:grid-cols-[1fr_1fr_1fr] md:gap-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
                Feature
              </span>
              <span className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">
                <BookOpen size={10} />
                KŌMA
              </span>
              <span className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                <Flame size={10} />
                Others
              </span>
            </div>

            {/* ── Rows ── */}
            <div className="divide-y divide-white/[0.04]">
              {matrix.map((row, i) => (
                <motion.div
                  key={row.label}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.12 + i * 0.09, duration: 0.5, ease: "easeOut" }}
                  className="grid gap-3 px-8 py-5 transition-colors duration-300 hover:bg-white/[0.02] md:grid-cols-[1fr_1fr_1fr] md:gap-4"
                >
                  {/* Feature */}
                  <div className="text-sm font-medium text-white/75">{row.label}</div>

                  {/* KŌMA */}
                  <div className="md:flex md:items-center md:justify-center">
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-400/[0.12] bg-emerald-400/[0.06] px-4 py-2.5 shadow-[0_0_24px_rgba(16,185,129,0.05)]">
                      <Check
                        size={14}
                        className="mt-0.5 shrink-0 text-emerald-400"
                        strokeWidth={2.5}
                      />
                      <span className="text-[13px] leading-snug text-emerald-200/90">
                        {row.koma}
                      </span>
                    </div>
                  </div>

                  {/* Others */}
                  <div className="md:flex md:items-center md:justify-center">
                    <div className="flex items-start gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-2.5">
                      <X
                        size={14}
                        className="mt-0.5 shrink-0 text-rose-400/40"
                        strokeWidth={2.5}
                      />
                      <span className="text-[13px] leading-snug text-white/30">{row.alt}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Bottom accent gradient line */}
            <div className="h-[2px] bg-[linear-gradient(90deg,transparent,rgba(16,185,129,0.4),rgba(168,85,247,0.3),transparent)]" />
          </motion.div>

          {/* ═══ RIGHT: ALTERNATIVES ═══ */}
          <div className="flex flex-col gap-4 lg:min-h-0" style={{ perspective: "1000px" }}>
            <div className="relative overflow-hidden rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-2 backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-[linear-gradient(180deg,rgba(6,8,16,0.92),rgba(6,8,16,0))]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-[linear-gradient(0deg,rgba(6,8,16,0.96),rgba(6,8,16,0))]" />

              <div className="mb-2 flex items-center justify-between px-3 pt-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                  Alternatives
                </div>
                <div className="text-[10px] font-medium text-white/25">
                  3 visible · scroll for more
                </div>
              </div>

              <div className="max-h-[520px] space-y-3 overflow-y-auto px-2 pb-2 pr-1 pt-1">
                {alternatives.map((item, i) => {
                  const st = item.status ? statusConfig[item.status] : null;

                  return (
                    <TiltCard key={item.name} className="min-h-[156px]">
                      <motion.a
                        href={item.href}
                        initial={{ opacity: 0, x: 24 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          delay: 0.08 + i * 0.065,
                          duration: 0.55,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="group relative block h-full overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl transition-all duration-500 hover:border-white/[0.13] hover:bg-white/[0.055] hover:shadow-[0_8px_40px_rgba(168,85,247,0.06)]"
                      >
                        {st && (
                          <span
                            className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full ${st.bar} opacity-60 transition-opacity duration-300 group-hover:opacity-100`}
                          />
                        )}

                        <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-purple-500/0 blur-2xl transition-all duration-500 group-hover:bg-purple-500/[0.12]" />

                        <div className="relative flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 pl-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[15px] font-semibold text-white/85">
                                {item.name}
                              </span>
                              {st && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border ${st.border} ${st.bg} px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${st.color}`}
                                >
                                  <st.Icon size={8} />
                                  {st.label}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-[13px] leading-relaxed text-white/35">
                              {item.summary}
                            </p>
                            {item.pricing && (
                              <p className="mt-1.5 text-[11px] font-medium text-white/20">
                                {item.pricing}
                              </p>
                            )}
                          </div>

                          <ArrowUpRight
                            size={15}
                            className="mt-0.5 shrink-0 text-purple-400/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-purple-300/80"
                          />
                        </div>

                        <div className="relative mt-4 flex items-center gap-2 pl-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-400/30 transition-colors duration-300 group-hover:text-purple-300/60">
                          <span className="h-px w-4 bg-current" />
                          Read comparison
                        </div>
                      </motion.a>
                    </TiltCard>
                  );
                })}
              </div>
            </div>

            {/* ── CTA Card ── */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.55, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                href="/compare"
                className="group relative block overflow-hidden rounded-2xl border border-purple-400/[0.14] bg-gradient-to-br from-purple-500/[0.08] via-transparent to-cyan-500/[0.04] p-6 shadow-[0_0_48px_rgba(168,85,247,0.07)] transition-all duration-500 hover:border-purple-400/[0.25] hover:shadow-[0_0_64px_rgba(168,85,247,0.13)]"
              >
                {/* Animated shimmer border */}
                <span className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  <span className="absolute inset-[1px] rounded-2xl bg-[linear-gradient(135deg,rgba(168,85,247,0.12),transparent_40%,transparent_60%,rgba(6,182,212,0.08))]" />
                </span>

                <div className="relative">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400/80" />
                    <span className="text-sm font-semibold text-white/85">
                      Need the full comparison hub?
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/35">
                    Explore every comparison page for the tools scanlation teams actually evaluate.
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-purple-300/50 transition-colors duration-300 group-hover:text-purple-200/80">
                    View all comparisons
                    <ArrowUpRight
                      size={12}
                      className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </span>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
