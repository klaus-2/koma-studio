"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Square, Cpu, Globe, Layers } from "lucide-react";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";

const MODES = {
  aio: { label: "All-in-One", steps: ["Detect panels", "OCR source", "Translate (LLM)", "Inpaint & clean", "Auto typeset", "Export"] },
  translate: { label: "Translate", steps: ["OCR source", "Context pass", "Translate (LLM)", "Glossary check"] },
  clean: { label: "Clean", steps: ["Detect text", "Mask bubbles", "Inpaint", "Denoise"] },
  typeset: { label: "Typeset", steps: ["Bubble-fit", "Font match", "Hyphenate", "Render"] },
} as const;
type ModeKey = keyof typeof MODES;

function MangaPage({ lang }: { lang: "jp" | "en" }) {
  const t = lang === "jp"
    ? ["まさか…！", "逃げろ！！", "これで終わりだ"]
    : ["No way…!", "RUN!!", "This ends now."];
  return (
    <div className="grid h-full grid-cols-2 grid-rows-3 gap-1.5 bg-paper p-1.5">
      {[0, 1, 2, 3].map((p) => (
        <div key={p} className={`relative overflow-hidden border-2 border-ink bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-600 ${p === 1 ? "row-span-2" : ""} ${p === 3 ? "col-span-2" : ""}`}>
          <div aria-hidden className="halftone absolute inset-0 opacity-30" />
          {p < 3 && (
            <span className="absolute left-2 top-2 max-w-[80%] rounded-[50%] border-2 border-ink bg-paper px-3 py-2 text-center text-[10px] font-bold leading-tight text-ink">
              {t[p]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AppPreview() {
  const [mode, setMode] = useState<ModeKey>("aio");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const steps = MODES[mode].steps;
  const progress = running || step >= 0 ? ((step + 1) / steps.length) * 100 : 0;

  const stop = () => { if (timer.current) clearInterval(timer.current); setRunning(false); };
  const run = () => {
    stop(); setStep(-1); setRunning(true);
    timer.current = setInterval(() => {
      setStep((s) => {
        if (s + 1 >= steps.length) { stop(); return s + 1 >= steps.length ? steps.length - 1 : s + 1; }
        return s + 1;
      });
    }, 850);
  };
  useEffect(() => () => stop(), []);
  const switchMode = (k: ModeKey) => {
    stop();
    setStep(-1);
    setMode(k);
  };

  return (
    <section id="studio" className="relative scroll-mt-24 border-y border-paper/10 bg-ink-2/40 py-32">
      <div aria-hidden className="halftone-red absolute inset-0 opacity-[0.06]" />
      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeader index="02" kicker="Desktop Studio" title="This is the" accent="whole workflow." sub="A live look at the KOMA pipeline. Pick a mode, hit run, watch a raw page become a release." />

        <Reveal>
          {/* mode tabs */}
          <div role="tablist" aria-label="Pipeline mode" className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(MODES) as ModeKey[]).map((k) => (
              <button key={k} role="tab" aria-selected={mode === k} onClick={() => switchMode(k)}
                className={`panel-cut-sm px-5 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest transition-all ${mode === k ? "bg-crimson font-bold text-ink" : "border border-paper/15 text-paper/50 hover:border-paper/40 hover:text-paper"}`}>
                {MODES[k].label}
              </button>
            ))}
          </div>

          {/* window */}
          <div className="glass panel-cut overflow-hidden">
            <div className="flex items-center gap-2 border-b border-paper/10 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-crimson/80" /><span className="h-3 w-3 rounded-full bg-gold/80" /><span className="h-3 w-3 rounded-full bg-mint/80" />
              <span className="ml-3 font-[family-name:var(--font-mono)] text-xs text-paper/40">koma://project/oneshot-ch-01 — {MODES[mode].label}</span>
            </div>

            <div className="grid lg:grid-cols-[220px_1fr_260px]">
              {/* left: files */}
              <aside className="hidden border-r border-paper/10 p-4 lg:block">
                <p className="kicker mb-3 !text-[10px]">Workspace</p>
                {["p001.png", "p002.png", "p003.png", "p004-005.png"].map((f, i) => (
                  <div key={f} className={`mb-1.5 flex items-center justify-between px-3 py-2 font-[family-name:var(--font-mono)] text-xs ${i === 0 ? "panel-cut-sm bg-crimson/15 text-crimson" : "text-paper/40"}`}>
                    <span>{f}</span>{i === 0 && <span aria-hidden>●</span>}
                  </div>
                ))}
                <div className="mt-6 border border-dashed border-paper/15 p-4 text-center text-[10px] uppercase tracking-widest text-paper/30">Drop raws here</div>
              </aside>

              {/* canvas */}
              <div className="relative flex items-center justify-center bg-ink p-6 lg:p-10">
                <div className="halftone absolute inset-0 opacity-20" aria-hidden />
                <div className="relative aspect-[3/4] w-full max-w-[300px] shadow-[8px_8px_0_rgba(255,46,99,0.35)]">
                  <MangaPage lang="jp" />
                  <div className="absolute inset-0 transition-[clip-path] duration-700 ease-out" style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}>
                    <MangaPage lang="en" />
                  </div>
                  {progress > 0 && progress < 100 && (
                    <div aria-hidden className="absolute top-0 h-full w-0.5 bg-crimson shadow-[0_0_16px_#ff2e63] transition-all duration-700" style={{ left: `${progress}%` }} />
                  )}
                </div>
                <span className="absolute bottom-3 right-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-paper/30" role="status">
                  {running ? `${steps[Math.max(step, 0)]}…` : progress >= 100 ? "✓ Release ready" : "Idle — raw loaded"}
                </span>
              </div>

              {/* right: pipeline */}
              <aside className="border-t border-paper/10 p-5 lg:border-l lg:border-t-0">
                <p className="kicker mb-4 !text-[10px]">Pipeline</p>
                <ol className="mb-6 space-y-2.5">
                  {steps.map((s, i) => (
                    <li key={s} className="flex items-center gap-3 font-[family-name:var(--font-mono)] text-xs">
                      <span className={`flex h-5 w-5 items-center justify-center border text-[9px] ${i <= step ? "border-crimson bg-crimson text-ink" : "border-paper/20 text-paper/30"}`}>
                        {i <= step ? "✓" : i + 1}
                      </span>
                      <span className={i <= step ? "text-paper" : "text-paper/35"}>{s}</span>
                      {i === step && running && <span className="animate-blink text-crimson">▮</span>}
                    </li>
                  ))}
                </ol>
                <div className="mb-5 space-y-2 text-xs text-paper/45">
                  <p className="flex items-center gap-2"><Globe size={13} className="text-azure" /> JA → EN · glossary on</p>
                  <p className="flex items-center gap-2"><Cpu size={13} className="text-mint" /> Local inpaint · GPU</p>
                  <p className="flex items-center gap-2"><Layers size={13} className="text-gold" /> Non-destructive layers</p>
                </div>
                <button onClick={running ? stop : run} className="btn-primary w-full justify-center !py-3 text-xs">
                  {running ? <><Square size={14} /> Stop</> : <><Play size={14} /> Run Pipeline</>}
                </button>
              </aside>
            </div>
          </div>
        </Reveal>

        {/* callouts */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[["Local-first", "Your art never leaves your machine."], ["Batch mode", "Queue whole volumes overnight."], ["Team roles", "TL, CL, TS and QC — with page locks."], ["Open API", "Plugins, hooks and your own models."]].map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.07}>
              <div className="glass panel-cut-sm h-full p-5">
                <p className="font-black uppercase tracking-wide text-crimson">{t}</p>
                <p className="mt-1 text-sm text-paper/50">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
