import { BookOpen, Code2, Languages, Palette, ArrowUpRight, Heart } from "lucide-react";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";
import { CONTRIBUTE_STEPS, CONTRIBUTE_ROLES, SITE_CONFIG } from "@/lib/data";

const ROLE_ICONS = [Code2, Languages, Palette, BookOpen];
const STEP_COLORS = ["#4dc9ff", "#3ef2b0", "#ffc857", "#ff2e63"];

export default function Contribute() {
  return (
    <section id="contribute" className="defer-render mx-auto max-w-7xl scroll-mt-24 px-6 py-32">
      <SectionHeader index="06" kicker="Contribute" title="Built by" accent="readers like you."
        sub="Every panel of this studio is drawn by the community. Here's how to pick up the pen." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CONTRIBUTE_STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.07}>
            <div className="glass panel-cut h-full p-6 transition-all duration-200 hover:-translate-y-1"
              style={{ borderColor: `${STEP_COLORS[i]}33` }}>
              <span aria-hidden className="text-outline text-5xl font-black">{s.n}</span>
              <h3 className="mt-4 text-lg font-black uppercase tracking-tight" style={{ color: STEP_COLORS[i] }}>{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper/55">{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <p className="mt-12 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.3em] text-paper/40">
          Not a coder? <span className="text-gold">Good — we need you anyway.</span>
        </p>
      </Reveal>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CONTRIBUTE_ROLES.map((r, i) => {
          const Icon = ROLE_ICONS[i];
          return (
            <Reveal key={r.title} delay={i * 0.07}>
              <div className="glass panel-cut-sm flex h-full items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-gold/40">
                <span className="panel-cut-sm border border-paper/10 bg-ink p-2.5 text-gold"><Icon size={18} /></span>
                <div>
                  <p className="font-black uppercase tracking-wide">{r.title}</p>
                  <p className="text-xs text-paper/50">{r.desc}</p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={0.1}>
        <div className="glass panel-cut relative mt-8 overflow-hidden p-8 md:p-10">
          <div aria-hidden className="halftone absolute inset-0 opacity-15" />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="flex items-center gap-2 font-black uppercase tracking-wide text-crimson">
                <Heart size={16} fill="currentColor" /> First PR merged → your name in CONTRIBUTORS, forever.
              </p>
              <p className="mt-2 max-w-xl text-sm text-paper/55">
                Kind reviews, mentored good-first-issues, and a code of conduct that keeps the studio welcoming.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href={SITE_CONFIG.contributing} target="_blank" rel="noreferrer" className="btn-primary !py-3 text-xs">
                <BookOpen size={14} /> Contributing guide
              </a>
              <a href={SITE_CONFIG.goodFirstIssues} target="_blank" rel="noreferrer" className="btn-ghost !py-3 text-xs">
                Good first issues <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
