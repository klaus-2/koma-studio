"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bug,
  Code2,
  GitFork,
  Languages,
  Lightbulb,
  MessageCircle,
  BookOpen,
} from "lucide-react";
import { SectionHeader } from "./ui/SectionHeader";
import { GitHubIcon } from "./ui/GitHubIcon";
import {
  SITE_CONTRIBUTE_PATH,
  SITE_DISCORD_URL,
  SITE_DISCUSSIONS_URL,
  SITE_GITHUB_URL,
  SITE_GOOD_FIRST_ISSUES_URL,
  SITE_ISSUES_URL,
} from "@/lib/site";

const WAYS = [
  {
    icon: Code2,
    title: "Code",
    body: "Fix a bug, add an OCR backend, improve the typesetting engine. Issues labelled for newcomers are the fastest way in.",
    action: { label: "Good first issues", href: SITE_GOOD_FIRST_ISSUES_URL },
    accent: "text-purple-400",
    surface: "border-koma-purple/15 bg-koma-purple/[0.06]",
  },
  {
    icon: Languages,
    title: "Translations",
    body: "The UI, the docs, and the translation glossaries all need native speakers. No build toolchain required.",
    action: { label: "Open a discussion", href: SITE_DISCUSSIONS_URL },
    accent: "text-cyan-400",
    surface: "border-koma-cyan/15 bg-koma-cyan/[0.06]",
  },
  {
    icon: BookOpen,
    title: "Docs & guides",
    body: "Setup notes, model comparisons, workflow write-ups. If you fought with it once, someone else will too.",
    action: { label: "Contributing guide", href: SITE_CONTRIBUTE_PATH },
    accent: "text-emerald-400",
    surface: "border-emerald-400/15 bg-emerald-400/[0.06]",
  },
  {
    icon: Bug,
    title: "Bug reports",
    body: "Reproducible reports with a sample page are worth more than a thousand stars. Triage is contribution too.",
    action: { label: "File an issue", href: SITE_ISSUES_URL },
    accent: "text-amber-400",
    surface: "border-amber-400/15 bg-amber-400/[0.06]",
  },
  {
    icon: Lightbulb,
    title: "Design & research",
    body: "Balloon layouts, font matching heuristics, redraw quality — research and critique shape the roadmap.",
    action: { label: "Join the Discord", href: SITE_DISCORD_URL },
    accent: "text-rose-400",
    surface: "border-rose-400/15 bg-rose-400/[0.06]",
  },
  {
    icon: GitFork,
    title: "Fork it",
    body: "Need something opinionated? MIT means you can take the code and build your own studio on top of it.",
    action: { label: "Browse the source", href: SITE_GITHUB_URL },
    accent: "text-violet-400",
    surface: "border-violet-400/15 bg-violet-400/[0.06]",
  },
];

const STEPS = [
  { label: "Fork", command: "gh repo fork klaus-2/koma-studio" },
  { label: "Branch", command: "git switch -c fix/balloon-fit" },
  { label: "Commit", command: "git commit -m \"fix: balloon fit on vertical text\"" },
  { label: "Pull request", command: "gh pr create --fill" },
];

export function Contribute() {
  return (
    <section
      id="contribute"
      className="relative overflow-hidden py-[var(--spacing-section)]"
      aria-label="Contribute"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/3 h-[500px] w-[500px] rounded-full bg-koma-purple/[0.06] blur-[130px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[420px] w-[420px] rounded-full bg-koma-cyan/[0.05] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeader
          badge="Contribute"
          title="Built by the People Who Actually Ship Chapters"
          subtitle="KŌMA is maintained in the open. Code, translations, docs, sample pages and bug reports all move the project forward — and you do not need to be a maintainer to start."
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WAYS.map((way, index) => {
            const Icon = way.icon;
            return (
              <motion.div
                key={way.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className="glass-card flex flex-col p-6 transition-all duration-300 hover:-translate-y-1 hover:border-koma-border-hover"
              >
                <div
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border ${way.surface}`}
                >
                  <Icon size={20} className={way.accent} />
                </div>
                <h3 className="font-[var(--font-display)] text-base font-semibold text-koma-text">
                  {way.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-koma-text-secondary">
                  {way.body}
                </p>
                {way.action.href.startsWith("http") ? (
                  <a
                    href={way.action.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-koma-purple-light transition-colors hover:text-koma-text"
                  >
                    {way.action.label}
                    <span aria-hidden="true">→</span>
                  </a>
                ) : (
                  <Link
                    href={way.action.href}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-koma-purple-light transition-colors hover:text-koma-text"
                  >
                    {way.action.label}
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Quickstart */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 md:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-koma-purple-light">
              Your first pull request
            </div>
            <ol className="mt-5 space-y-4">
              {STEPS.map((step, index) => (
                <li key={step.label} className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-koma-purple/20 bg-koma-purple/10 font-[var(--font-mono)] text-xs font-bold text-koma-purple-light">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-koma-text">{step.label}</div>
                    <code className="mt-1 block overflow-x-auto font-[var(--font-mono)] text-xs text-koma-muted">
                      {step.command}
                    </code>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col justify-between gap-5 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-koma-purple/[0.07] via-transparent to-koma-cyan/[0.05] p-6 md:p-8">
            <div>
              <h3 className="font-[var(--font-display)] text-xl font-semibold text-koma-text">
                Not ready to commit code?
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-koma-text-secondary">
                Star the repo, share it with your group, or drop into the Discord and tell us what
                breaks on real chapters. Visibility is how a project like this finds its
                contributors.
              </p>
            </div>

            <div className="space-y-2">
              <a
                href={SITE_GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-3 text-sm font-semibold text-koma-text ring-1 ring-white/10 transition-colors hover:bg-white/[0.1]"
              >
                <GitHubIcon size={16} />
                Star on GitHub
              </a>
              <a
                href={SITE_DISCORD_URL}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 py-3 text-sm font-medium text-koma-text-secondary transition-colors hover:border-white/20 hover:text-koma-text"
              >
                <MessageCircle size={16} />
                Talk to the community
              </a>
              <Link
                href={SITE_CONTRIBUTE_PATH}
                className="block text-center text-xs text-koma-muted transition-colors hover:text-koma-text"
              >
                Read the full contributing guide →
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
