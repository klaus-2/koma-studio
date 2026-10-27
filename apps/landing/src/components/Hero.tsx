import { Download, ArrowRight } from "lucide-react";
import StarButton from "./StarButton";

const WORDS = [
  { w: "TRANSLATED", c: "text-crimson" },
  { w: "CLEANED", c: "text-azure" },
  { w: "TYPESET", c: "text-mint" },
  { w: "REDRAWN", c: "text-gold" },
  { w: "PUBLISHED", c: "text-crimson" },
];

const STATS = [["MIT", "License"], ["100%", "Open Source"], ["0", "Trackers · Ads · Paywalls"]] as const;

export default function Hero() {
  return (
    <section className="relative flex min-h-dvh items-center overflow-hidden pt-16">
      {/* background layers */}
      <div aria-hidden className="hero-halftone halftone absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div aria-hidden className="hero-glow absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-crimson/15 blur-[120px]" />
      <div aria-hidden className="hero-glow absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />
      <span aria-hidden className="v-text absolute right-6 top-24 hidden select-none font-black text-paper/[0.06] xl:block" style={{ fontSize: "6rem", letterSpacing: "0.1em" }}>
        コマスタジオ
      </span>
      <span aria-hidden className="v-text absolute left-6 bottom-24 hidden select-none font-[family-name:var(--font-mono)] text-xs tracking-[0.5em] text-crimson/40 xl:block">
        EVERY PANEL TELLS A STORY
      </span>

      <div className="relative mx-auto w-full max-w-7xl px-6 py-24">
        <div className="hero-rise">
          <span className="stamp animate-float">
            <span className="h-1.5 w-1.5 animate-blink bg-mint" /> 100% open source — MIT licensed
          </span>
        </div>

        <h1 className="hero-rise hero-rise-2 mt-8 text-[13vw] font-black uppercase leading-[0.88] tracking-tighter sm:text-7xl md:text-8xl lg:text-[7.5rem]">
          Raw chapter,
          <br />
          <span className="relative inline-block h-[1em] min-w-[7ch] align-top">
            {WORDS.map((word, index) => (
              <span
                key={word.w}
                className={`hero-word ${word.c}`}
                style={{ animationDelay: `${index * 2.2}s` }}
              >
                {word.w}
              </span>
            ))}
          </span>
          <br />
          <span className="text-outline">in one studio.</span>
        </h1>

        <p className="hero-rise hero-rise-3 mt-8 max-w-xl text-lg text-paper/60">
          KOMA Studio is a free, open-source scanlation pipeline — translate, clean, typeset
          and publish without leaving one window. <em className="font-[family-name:var(--font-accent)] italic text-paper">From raw to release</em>,
          owned by its community.
        </p>

        <div className="hero-rise hero-rise-4 mt-10 flex flex-wrap items-center gap-4">
          <StarButton />
          <a href="#download" className="btn-ghost"><Download size={18} /> Download Free</a>
          <a href="#contribute" className="group inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-paper/50 transition-colors hover:text-mint">
            or contribute <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </a>
        </div>
        <p className="hero-rise hero-rise-5 mt-4 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-paper/35">
          Windows · macOS · Linux — binaries on every release
        </p>

        <div className="hero-rise hero-rise-6 mt-12 grid max-w-2xl grid-cols-3 gap-3">
          {STATS.map(([n, label]) => (
            <div key={label} className="glass panel-cut-sm p-5 transition-transform hover:-translate-y-1">
              <p className="text-3xl font-black text-mint">{n}</p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-paper/50">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
