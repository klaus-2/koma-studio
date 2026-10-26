import { BookOpen } from "lucide-react";
import Reveal from "./Reveal";
import StarButton from "./StarButton";
import LatestDownloadButton from "./LatestDownloadButton";
import { SITE_CONFIG } from "@/lib/data";

export default function FinalCta() {
  return (
    <section id="download" className="scroll-mt-24 px-6 pb-32">
      <Reveal>
        <div className="glass panel-cut relative mx-auto max-w-5xl overflow-hidden p-12 text-center md:p-20">
          <div aria-hidden className="halftone-red absolute inset-0 opacity-10" />
          <div aria-hidden className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-crimson/20 blur-[100px]" />
          <div aria-hidden className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-gold/15 blur-[100px]" />
          <div className="relative">
            <span className="panel-cut-sm mx-auto flex h-16 w-16 items-center justify-center bg-crimson text-3xl font-black text-ink">コ</span>
            <h2 className="mx-auto mt-8 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tight md:text-6xl">
              Own your tools.{" "}
              <em className="font-[family-name:var(--font-accent)] font-normal normal-case italic text-crimson">Star the press.</em>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-paper/55">
              KOMA Studio is free, open-source software under the MIT license.
              Star it, download it, fork it — or help draw the next panel.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <StarButton />
              <LatestDownloadButton />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <a href={SITE_CONFIG.contributing} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-paper/50 transition-colors hover:text-mint">
                <BookOpen size={14} /> Read the contributing guide
              </a>
              <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-paper/35">Windows installer · macOS and Linux from source</span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
