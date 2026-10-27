"use client";
import { useRef } from "react";
import { Check, X, ArrowUpRight, Code2 } from "lucide-react";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";
import { SITE_CONFIG } from "@/lib/data";

const ROWS = [
  ["Source code", "MIT — audit & fork", "Black box"],
  ["Price", "Free forever", "Seats & credits"],
  ["Your data", "Local, zero telemetry", "Uploaded & metered"],
  ["Roadmap", "Voted in public", "Decided in private"],
  ["If we shut down", "Fork it — it lives on", "Your tool dies too"],
];

const CARDS = [
  { name: "MIT License", desc: "Free for commercial use, forever.", status: "Read it", href: SITE_CONFIG.licenseFile, c: "#3ef2b0" },
  { name: "Open Roadmap", desc: "Vote on what ships next.", status: "Vote", href: SITE_CONFIG.issues, c: "#ffc857" },
  { name: "Discussions", desc: "Ask anything, get answers.", status: "Join", href: SITE_CONFIG.discussions, c: "#4dc9ff" },
];

function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="glass panel-cut-sm p-5 transition-transform duration-150 will-change-transform"
      onMouseMove={(e) => {
        const el = ref.current; if (!el) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
      }}
      onMouseLeave={() => { if (ref.current) ref.current.style.transform = ""; }}
    >
      {children}
    </div>
  );
}

export default function Comparison() {
  return (
    <section id="compare" className="defer-render relative scroll-mt-24 border-y border-paper/10 bg-ink-2/40 py-32">
      <div aria-hidden className="absolute left-1/4 top-0 h-64 w-64 rounded-full bg-mint/10 blur-[100px]" />
      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeader index="05" kicker="Open vs Closed" title="Why open" accent="wins." sub="Proprietary tools rent you a workflow. KOMA hands you the press." />

        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <div className="glass panel-cut overflow-hidden">
              <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-paper/10 bg-ink px-6 py-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em]">
                <span className="text-paper/40">Capability</span>
                <span className="text-mint">KOMA · Open</span>
                <span className="text-paper/40">Closed tools</span>
              </div>
              {ROWS.map(([f, k, o], i) => (
                <div key={f} className={`grid grid-cols-[1.4fr_1fr_1fr] items-center px-6 py-4 text-sm ${i % 2 ? "bg-paper/[0.02]" : ""}`}>
                  <span className="pr-4 text-paper/70">{f}</span>
                  <span className="flex items-center gap-2 font-bold text-mint"><Check size={14} /> {k}</span>
                  <span className="flex items-center gap-2 text-paper/35"><X size={14} className="text-crimson/60" /> {o}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <div className="space-y-3">
            {CARDS.map((r, i) => (
              <Reveal key={r.name} delay={i * 0.07}>
                <TiltCard>
                  <div className="flex items-center justify-between">
                    <p className="font-black uppercase tracking-wide">{r.name}</p>
                    <span className="border px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest" style={{ borderColor: `${r.c}66`, color: r.c }}>{r.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-paper/50">{r.desc}</p>
                  <a href={r.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-paper/40 transition-colors hover:text-crimson">
                    Open on GitHub <ArrowUpRight size={12} />
                  </a>
                </TiltCard>
              </Reveal>
            ))}
            <Reveal delay={0.25}>
              <a href={SITE_CONFIG.github} target="_blank" rel="noreferrer" className="btn-ghost w-full justify-center text-xs"><Code2 size={14} /> Browse the code <ArrowUpRight size={14} /></a>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
