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
  const tabs = Object.keys(MODES) as ModeKey[];
  return (
    <section id="studio" data-app-preview data-modes={JSON.stringify(MODES)} className="defer-render relative scroll-mt-24 border-y border-paper/10 bg-ink-2/40 py-32">
      <div aria-hidden className="halftone-red absolute inset-0 opacity-[0.06]" />
      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeader index="02" kicker="Desktop Studio" title="This is the" accent="whole workflow." sub="A live look at the KOMA pipeline. Pick a mode, hit run, watch a raw page become a release." />

        <Reveal>
          <div role="tablist" aria-label="Pipeline mode" className="mb-4 flex flex-wrap gap-2">
            {tabs.map((key) => (
              <button key={key} type="button" role="tab" data-preview-mode={key} aria-selected={key === "aio"}
                className={`panel-cut-sm px-5 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest transition-all ${key === "aio" ? "bg-crimson font-bold text-ink" : "border border-paper/15 text-paper/50 hover:border-paper/40 hover:text-paper"}`}>
                {MODES[key].label}
              </button>
            ))}
          </div>

          <div className="glass panel-cut overflow-hidden">
            <div className="flex items-center gap-2 border-b border-paper/10 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-crimson/80" /><span className="h-3 w-3 rounded-full bg-gold/80" /><span className="h-3 w-3 rounded-full bg-mint/80" />
              <span className="ml-3 font-[family-name:var(--font-mono)] text-xs text-paper/40" data-preview-title>koma://project/oneshot-ch-01 — {MODES.aio.label}</span>
            </div>

            <div className="grid lg:grid-cols-[220px_1fr_260px]">
              <aside className="hidden border-r border-paper/10 p-4 lg:block">
                <p className="kicker mb-3 !text-[10px]">Workspace</p>
                {["p001.png", "p002.png", "p003.png", "p004-005.png"].map((f, i) => (
                  <div key={f} className={`mb-1.5 flex items-center justify-between px-3 py-2 font-[family-name:var(--font-mono)] text-xs ${i === 0 ? "panel-cut-sm bg-crimson/15 text-crimson" : "text-paper/40"}`}>
                    <span>{f}</span>{i === 0 && <span aria-hidden>●</span>}
                  </div>
                ))}
                <div className="mt-6 border border-dashed border-paper/15 p-4 text-center text-[10px] uppercase tracking-widest text-paper/30">Drop raws here</div>
              </aside>

              <div className="relative flex items-center justify-center bg-ink p-6 lg:p-10">
                <div className="halftone absolute inset-0 opacity-20" aria-hidden />
                <div className="relative aspect-[3/4] w-full max-w-[300px] shadow-[8px_8px_0_rgba(255,46,99,0.35)]">
                  <MangaPage lang="jp" />
                  <div className="absolute inset-0 transition-[clip-path] duration-700 ease-out" data-preview-clip style={{ clipPath: "inset(0 100% 0 0)" }}>
                    <MangaPage lang="en" />
                  </div>
                  <div data-preview-cursor aria-hidden className="absolute top-0 hidden h-full w-0.5 bg-crimson shadow-[0_0_16px_#ff2e63]" style={{ left: "0%" }} />
                </div>
                <span className="absolute bottom-3 right-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-paper/30" role="status" data-preview-status>
                  Idle — raw loaded
                </span>
              </div>

              <aside className="border-t border-paper/10 p-5 lg:border-l lg:border-t-0">
                <p className="kicker mb-4 !text-[10px]">Pipeline</p>
                <div className="mb-6">
                  {tabs.map((key) => (
                    <ol key={key} data-preview-steps={key} className={`space-y-2.5 ${key === "aio" ? "" : "hidden"}`}>
                      {MODES[key].steps.map((step, i) => (
                        <li key={step} className="flex items-center gap-3 font-[family-name:var(--font-mono)] text-xs">
                          <span data-preview-marker className="flex h-5 w-5 items-center justify-center border border-paper/20 text-[9px] text-paper/30">{i + 1}</span>
                          <span data-preview-label className="text-paper/35">{step}</span>
                          <span data-preview-cursor className="hidden animate-blink text-crimson">▮</span>
                        </li>
                      ))}
                    </ol>
                  ))}
                </div>
                <div className="mb-5 space-y-2 text-xs text-paper/45">
                  <p className="flex items-center gap-2"><Globe size={13} className="text-azure" /> JA → EN · glossary on</p>
                  <p className="flex items-center gap-2"><Cpu size={13} className="text-mint" /> Local inpaint · GPU</p>
                  <p className="flex items-center gap-2"><Layers size={13} className="text-gold" /> Non-destructive layers</p>
                </div>
                <button type="button" data-preview-run className="btn-primary w-full justify-center !py-3 text-xs">
                  <span data-preview-start className="inline-flex items-center gap-2"><Play size={14} /> Run Pipeline</span>
                  <span data-preview-stop className="hidden items-center gap-2"><Square size={14} /> Stop</span>
                </button>
              </aside>
            </div>
          </div>
        </Reveal>

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
