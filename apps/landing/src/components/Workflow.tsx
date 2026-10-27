import { Inbox, Paintbrush, PenTool, Rocket } from "lucide-react";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";
import { STEPS } from "@/lib/data";

const ICONS = [Inbox, Paintbrush, PenTool, Rocket];
const C: Record<string, string> = { azure: "#4dc9ff", mint: "#3ef2b0", gold: "#ffc857", crimson: "#ff2e63" };

export default function Workflow() {
  return (
    <section id="workflow" data-workflow className="defer-render mx-auto max-w-7xl scroll-mt-24 px-6 py-32">
      <SectionHeader index="03" kicker="Workflow" title="Four acts." accent="Zero friction." sub="The chapter moves through the studio like panels through a page — in order, without app-switching." />

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          {STEPS.map((s, i) => {
            const SIcon = ICONS[i];
            const open = i === 0;
            const color = C[s.color];
            return (
              <button
                key={s.id}
                type="button"
                data-workflow-step={i}
                data-workflow-color={color}
                aria-expanded={open}
                className={`glass panel-cut block w-full p-6 text-left transition-all ${open ? "-translate-x-1" : "opacity-60 hover:opacity-90"}`}
                style={open ? { borderColor: `${color}66`, boxShadow: `6px 6px 0 ${color}55` } : undefined}
              >
                <div className="flex items-center gap-4">
                  <span className="panel-cut-sm border border-paper/10 bg-ink p-2.5" style={{ color }}><SIcon size={18} /></span>
                  <div className="flex-1">
                    <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em]" style={{ color }}>Act 0{s.id}</p>
                    <h3 className="font-black uppercase">{s.title}</h3>
                  </div>
                  <span aria-hidden className="text-outline text-3xl font-black">0{s.id}</span>
                </div>
                <div
                  data-workflow-body={i}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    <p className="mt-4 text-sm text-paper/60">{s.body}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {s.tags.map((t) => (
                        <span key={t} className="border px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest" style={{ borderColor: `${color}55`, color }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <Reveal className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative">
            {STEPS.map((s, i) => {
              const Icon = ICONS[i];
              const color = C[s.color];
              return (
                <div
                  key={s.id}
                  data-workflow-panel={i}
                  className={`glass panel-cut relative overflow-hidden p-8 ${i === 0 ? "panel-in" : "hidden"}`}
                  style={{ borderColor: `${color}44` }}
                >
                  <div aria-hidden className="halftone absolute inset-0 opacity-15" />
                  <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full blur-[80px]" style={{ background: `${color}33` }} />
                  <div className="relative">
                    <span className="panel-cut-sm inline-block border border-paper/10 bg-ink p-4" style={{ color }}><Icon size={36} /></span>
                    <p className="kicker mt-6" style={{ color }}>{`// ACT 0${s.id}`}</p>
                    <h3 className="mt-2 text-3xl font-black uppercase">{s.title}</h3>
                    <p className="mt-1 font-[family-name:var(--font-accent)] text-xl italic text-paper/70">{s.sub}</p>
                    <div className="mt-8 space-y-3">
                      {[92, 68, 84].map((w, barIndex) => (
                        <div key={barIndex} className="h-2 w-full bg-paper/10">
                          <div className="h-full transition-[width] duration-700" style={{ width: `${w}%`, background: color, transitionDelay: `${0.15 * barIndex}s` }} />
                        </div>
                      ))}
                    </div>
                    <p className="mt-6 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-paper/35">Status: ✓ ready for next act</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
