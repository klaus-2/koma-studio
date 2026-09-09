import Link from "next/link";
import { ArrowRight, Download, MessageCircle } from "lucide-react";
import { KomaLogo } from "./ui/KomaLogo";
import { GitHubIcon } from "./ui/GitHubIcon";
import {
  SITE_DISCORD_URL,
  SITE_GITHUB_URL,
  SITE_LICENSE,
  SITE_REPO_NAME,
  SITE_REPO_OWNER,
} from "@/lib/site";

export function FinalCTA() {
  return (
    <section id="download" className="py-[var(--spacing-section)]">
      <div className="mx-auto max-w-5xl px-6">
        <div className="glass-card relative overflow-hidden px-8 py-14 text-center md:px-14 md:py-18">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.14),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.1),transparent_40%)]" />
          <div className="relative">
            <div className="mb-6 flex justify-center">
              <KomaLogo size={68} showText={false} />
            </div>
            <h2 className="font-[var(--font-display)] text-3xl font-bold tracking-tight text-koma-text md:text-5xl">
              A Scanlation Studio You
              <br />
              <span className="gradient-text-static">Actually Own.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-koma-text-secondary md:text-lg">
              Download the build, read the source, or fork it and make it yours. {SITE_LICENSE}
              -licensed, free forever, no account and no credit balance.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/download" className="btn-glow inline-flex items-center gap-2.5 text-base">
                <Download size={18} />
                Download KŌMA Free
                <ArrowRight size={16} className="opacity-60" />
              </Link>
              <a
                href={SITE_GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2.5 rounded-full border border-koma-border-hover bg-white/[0.03] px-8 py-3.5 text-base font-medium text-koma-text transition-all hover:border-koma-purple/30 hover:bg-white/[0.06]"
              >
                <GitHubIcon size={18} />
                Star on GitHub
              </a>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              <code className="rounded-lg border border-white/[0.06] bg-black/30 px-4 py-2 font-[var(--font-mono)] text-xs text-koma-muted">
                git clone https://github.com/{SITE_REPO_OWNER}/{SITE_REPO_NAME}.git
              </code>
              <a
                href={SITE_DISCORD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-koma-muted transition-colors hover:text-koma-text"
              >
                <MessageCircle size={14} />
                Or come say hi on Discord
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
