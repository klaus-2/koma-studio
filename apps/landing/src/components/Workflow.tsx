"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, Paintbrush, PenTool, Rocket } from "lucide-react";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";
import { STEPS } from "@/lib/data";

const ICONS = [Inbox, Paintbrush, PenTool, Rocket];
const C: Record<string, string> = { azure: "#4dc9ff", mint: "#3ef2b0", gold: "#ffc857", crimson: "#ff2e63" };

export default function Workflow() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];
  const Icon = ICONS[active];
  const color = C[step.color];

  return (
    <section id="workflow" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-32">
      <SectionHeader index="03" kicker="Workflow" title="Four acts." accent="Zero friction." sub="The chapter moves through the studio like panels through a page — in order, without app-switching." />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* accordion */}
        <div className="space-y-3">
          {STEPS.map((s, i) => {
            const SIcon = ICONS[i];
            const open = i === active;
            return (
              <button key={s.id} onClick={() => setActive(i)} aria-expanded={open}
                className={`glass panel-cut block w-full p-6 text-left transition-all ${open ? "-translate-x-1" : "opacity-60 hover:opacity-90"}`}
                style={open ? { borderColor: `${C[s.color]}66`, boxShadow: `6px 6px 0 ${C[s.color]}55` } : undefined}>
                <div className="flex items-center gap-4">
                  <span className="panel-cut-sm border border-paper/10 bg-ink p-2.5" style={{ color: C[s.color] }}><SIcon size={18} /></span>
                  <div className="flex-1">
                    <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em]" style={{ color: C[s.color] }}>Act 0{s.id}</p>
                    <h3 className="font-black uppercase">{s.title}</h3>
                  </div>
                  <span aria-hidden className="text-outline text-3xl font-black">0{s.id}</span>
                </div>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                      <p className="mt-4 text-sm text-paper/60">{s.body}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {s.tags.map((t) => (
                          <span key={t} className="border px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest" style={{ borderColor: `${C[s.color]}55`, color: C[s.color] }}>{t}</span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>

        {/* preview panel */}
        <Reveal className="lg:sticky lg:top-24 lg:self-start">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35 }}
              className="glass panel-cut relative overflow-hidden p-8" style={{ borderColor: `${color}44` }}>
              <div aria-hidden className="halftone absolute inset-0 opacity-15" />
              <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full blur-[80px]" style={{ background: `${color}33` }} />
              <div className="relative">
                <span className="panel-cut-sm inline-block border border-paper/10 bg-ink p-4" style={{ color }}><Icon size={36} /></span>
                <p className="kicker mt-6" style={{ color }}>{`// ACT 0${step.id}`}</p>
                <h3 className="mt-2 text-3xl font-black uppercase">{step.title}</h3>
                <p className="mt-1 font-[family-name:var(--font-accent)] text-xl italic text-paper/70">{step.sub}</p>
                {/* fake progress bars */}
                <div className="mt-8 space-y-3">
                  {[92, 68, 84].map((w, i) => (
                    <div key={i} className="h-2 w-full bg-paper/10">
                      <motion.div className="h-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.8, delay: 0.15 * i }} />
                    </div>
                  ))}
                </div>
                <p className="mt-6 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-paper/35">Status: ✓ ready for next act</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </Reveal>
      </div>
    </section>
  );
}
