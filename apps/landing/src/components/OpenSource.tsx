"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Check,
  Copy,
  Eye,
  GitBranch,
  Infinity as InfinityIcon,
  Scale,
  Terminal,
} from "lucide-react";
import { SectionHeader } from "./ui/SectionHeader";
import { GitHubIcon } from "./ui/GitHubIcon";
import {
  SITE_ISSUES_URL,
  SITE_LICENSE,
  SITE_LICENSE_URL,
  SITE_MILESTONES_URL,
  SITE_OPEN_SOURCE_PATH,
  SITE_REPO_NAME,
  SITE_REPO_OWNER,
} from "@/lib/site";

const CLONE_COMMAND = `git clone https://github.com/${SITE_REPO_OWNER}/${SITE_REPO_NAME}.git
cd ${SITE_REPO_NAME}
# then follow the build instructions in the README`;

const PILLARS = [
  {
    icon: Scale,
    title: `${SITE_LICENSE} licensed`,
    body: "Use it, fork it, ship it commercially, reskin it for your group. The only requirement is keeping the license notice.",
  },
  {
    icon: Eye,
    title: "Auditable by anyone",
    body: "Every prompt, every model call, every export path is in the repository. If you want to know what happens to a page, you read the code.",
  },
  {
    icon: InfinityIcon,
    title: "No paywalled features",
    body: "There is no pro tier hiding the good parts. The build you compile yourself has the same capabilities as the published binary.",
  },
  {
    icon: GitBranch,
    title: "Roadmap in the open",
    body: "Milestones, issues, and pull requests are public. You can see what is being worked on and argue for what should come next.",
  },
];

export function OpenSource() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CLONE_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context or denied permission).
    }
  };

  return (
    <section
      id="open-source"
      className="relative overflow-hidden py-[var(--spacing-section)]"
      aria-label="Open source"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/[0.05] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeader
          badge="Open source"
          title="Free Software, Not a Free Trial"
          subtitle="KŌMA Studio is developed in the open under the MIT license. No credits, no seats, no feature hostages — just the source, the issues, and a community building the tool it wants to use."
        />

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: index * 0.06 }}
                className="glass-card glass-card-hover p-6"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.08]">
                  <Icon size={20} className="text-emerald-400" />
                </div>
                <h3 className="font-[var(--font-display)] text-base font-semibold text-koma-text">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-koma-text-secondary">
                  {pillar.body}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Clone / contribute strip */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#05070f]/80">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
              <div className="flex items-center gap-2 text-xs text-koma-muted">
                <Terminal size={14} />
                <span className="font-[var(--font-mono)]">build from source</span>
              </div>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs text-koma-text-secondary transition-colors hover:border-koma-purple/30 hover:text-koma-text"
                aria-label="Copy clone command"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-x-auto px-5 py-5 font-[var(--font-mono)] text-[13px] leading-relaxed text-koma-text-secondary">
              <code>{CLONE_COMMAND}</code>
            </pre>
          </div>

          <div className="flex flex-col justify-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
            <a
              href={SITE_LICENSE_URL}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.03]"
            >
              <Scale size={16} className="mt-0.5 shrink-0 text-emerald-400" />
              <span>
                <span className="block text-sm font-medium text-koma-text">
                  Read the {SITE_LICENSE} license
                </span>
                <span className="block text-xs text-koma-muted">
                  Permissive, commercial-use friendly
                </span>
              </span>
            </a>
            <a
              href={SITE_ISSUES_URL}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.03]"
            >
              <BookOpen size={16} className="mt-0.5 shrink-0 text-koma-purple" />
              <span>
                <span className="block text-sm font-medium text-koma-text">
                  Browse open issues
                </span>
                <span className="block text-xs text-koma-muted">
                  Bugs, features and discussions
                </span>
              </span>
            </a>
            <a
              href={SITE_MILESTONES_URL}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.03]"
            >
              <GitBranch size={16} className="mt-0.5 shrink-0 text-koma-cyan" />
              <span>
                <span className="block text-sm font-medium text-koma-text">
                  Public milestones
                </span>
                <span className="block text-xs text-koma-muted">
                  See what is shipping next
                </span>
              </span>
            </a>
            <Link
              href={SITE_OPEN_SOURCE_PATH}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl border border-koma-border-hover bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-koma-text transition-colors hover:border-koma-purple/30 hover:bg-white/[0.06]"
            >
              <GitHubIcon size={15} />
              How the project is run
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
