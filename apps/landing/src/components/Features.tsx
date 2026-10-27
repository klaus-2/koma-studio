"use client";
import { motion } from "framer-motion";
import { Languages, Eraser, Type, Wand2, FolderOpen, ShieldCheck, Check } from "lucide-react";
import SectionHeader from "./SectionHeader";
import { FEATURES } from "@/lib/data";

const ICONS = [Languages, Eraser, Type, Wand2, FolderOpen, ShieldCheck];
const SPANS = ["lg:col-span-2", "", "", "", "", "lg:col-span-3"];
const COLORS: Record<string, { text: string; border: string; shadow: string }> = {
  crimson: { text: "text-crimson", border: "hover:border-crimson/50", shadow: "hover:shadow-[6px_6px_0_#ff2e63]" },
  azure: { text: "text-azure", border: "hover:border-azure/50", shadow: "hover:shadow-[6px_6px_0_#4dc9ff]" },
  mint: { text: "text-mint", border: "hover:border-mint/50", shadow: "hover:shadow-[6px_6px_0_#3ef2b0]" },
  gold: { text: "text-gold", border: "hover:border-gold/50", shadow: "hover:shadow-[6px_6px_0_#ffc857]" },
};

export default function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-7xl scroll-mt-24 px-6 py-32">
      <SectionHeader index="01" kicker="Features" title="Six tools." accent="One ink." sub="Everything a scanlation team needs — engineered as a single pipeline instead of a folder full of apps." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = ICONS[i];
          const c = COLORS[f.color];
          return (
            <motion.article
              key={f.n}
              className={`glass panel-cut group p-7 transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 ${c.border} ${c.shadow} ${SPANS[i]}`}
              initial={{ y: 24 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
            >
              <div className="flex items-start justify-between">
                <span className={`panel-cut-sm border border-paper/10 bg-ink p-3 ${c.text}`}><Icon size={22} /></span>
                <span aria-hidden className="text-outline text-5xl font-black">{f.n}</span>
              </div>
              <h3 className="mt-6 text-2xl font-black uppercase tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper/55">{f.desc}</p>
              <ul className="mt-5 grid gap-2 text-xs text-paper/45 sm:grid-cols-2">
                {f.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <Check size={12} className={c.text} /> {b}
                  </li>
                ))}
              </ul>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
