"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Scale, EyeOff, HardDrive, GitFork, Users, Blocks, Check, Copy, ArrowUpRight } from "lucide-react";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";
import { PRINCIPLES, SITE_CONFIG } from "@/lib/data";

const ICONS = [Scale, EyeOff, HardDrive, GitFork, Users, Blocks];
const COLORS: Record<string, { text: string; border: string; shadow: string }> = {
  crimson: { text: "text-crimson", border: "hover:border-crimson/50", shadow: "hover:shadow-[6px_6px_0_#ff2e63]" },
  azure: { text: "text-azure", border: "hover:border-azure/50", shadow: "hover:shadow-[6px_6px_0_#4dc9ff]" },
  mint: { text: "text-mint", border: "hover:border-mint/50", shadow: "hover:shadow-[6px_6px_0_#3ef2b0]" },
  gold: { text: "text-gold", border: "hover:border-gold/50", shadow: "hover:shadow-[6px_6px_0_#ffc857]" },
};

const PERMISSIONS = ["Commercial use", "Modification", "Distribution", "Private use"];

function Terminal() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(`git clone ${SITE_CONFIG.cloneUrl}`)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="glass panel-cut flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-paper/10 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-crimson/80" /><span className="h-3 w-3 rounded-full bg-gold/80" /><span className="h-3 w-3 rounded-full bg-mint/80" />
        <span className="ml-3 font-[family-name:var(--font-mono)] text-xs text-paper/40">guest@koma: ~/studio</span>
        <button onClick={copy} aria-label="Copy clone command"
          className="ml-auto inline-flex items-center gap-1.5 border border-paper/15 px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-paper/50 transition-colors hover:border-mint/60 hover:text-mint">
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Clone</>}
        </button>
      </div>
      <div className="flex-1 space-y-3 p-6 font-[family-name:var(--font-mono)] text-[13px] leading-relaxed">
        <p><span className="text-crimson">$</span> <span className="text-paper/85">git clone {SITE_CONFIG.cloneUrl}</span></p>
        <p><span className="text-crimson">$</span> <span className="text-paper/85">cd koma-studio</span></p>
        <p><span className="text-crimson">$</span> <span className="text-paper/85">cat LICENSE</span></p>
        <p className="text-mint">✓ MIT License — free forever. Yours to fork.</p>
        <p className="text-paper/30">✓ 0 trackers · 0 accounts · 0 paywalls found</p>
      </div>
    </div>
  );
}

export default function OpenSource() {
  return (
    <section id="open-source" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-32">
      <SectionHeader index="04" kicker="Open Source" title="Free as in" accent="freedom."
        sub="No tiers, no credits, no black boxes. Every line of the studio is public, auditable — and yours to fork." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal><Terminal /></Reveal>
        <Reveal delay={0.08}>
          <div className="glass panel-cut flex h-full flex-col p-8">
            <div className="flex items-start justify-between">
              <span className="panel-cut-sm border border-mint/40 bg-mint/10 p-3 text-mint"><Scale size={26} /></span>
              <span aria-hidden className="text-outline text-6xl font-black">MIT</span>
            </div>
            <h3 className="mt-6 text-2xl font-black uppercase tracking-tight">One short license. Zero lawyers.</h3>
            <p className="mt-2 text-sm leading-relaxed text-paper/55">
              Use KOMA commercially, modify it, redistribute it, embed it in your own product.
            </p>
            <ul className="mt-5 grid gap-2 text-xs text-paper/60 sm:grid-cols-2">
              {PERMISSIONS.map((p) => (
                <li key={p} className="flex items-center gap-2"><Check size={13} className="text-mint" /> {p}</li>
              ))}
            </ul>
            <a href={SITE_CONFIG.licenseFile} target="_blank" rel="noreferrer"
              className="mt-auto inline-flex items-center gap-1 pt-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-widest text-mint transition-colors hover:text-paper">
              Read the license <ArrowUpRight size={13} />
            </a>
          </div>
        </Reveal>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PRINCIPLES.map((p, i) => {
          const Icon = ICONS[i];
          const c = COLORS[p.color];
          return (
            <motion.article
              key={p.title}
              className={`glass panel-cut-sm group p-6 transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 ${c.border} ${c.shadow}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
            >
              <span className={`panel-cut-sm inline-block border border-paper/10 bg-ink p-2.5 ${c.text}`}><Icon size={20} /></span>
              <h3 className="mt-4 text-lg font-black uppercase tracking-tight">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-paper/55">{p.desc}</p>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
