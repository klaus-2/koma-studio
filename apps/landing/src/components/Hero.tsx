"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative flex min-h-dvh items-center overflow-hidden pt-16">
      {/* background layers */}
      <div aria-hidden className="halftone absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div aria-hidden className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-crimson/15 blur-[120px]" />
      <div aria-hidden className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />
      <span aria-hidden className="v-text absolute right-6 top-24 hidden select-none font-black text-paper/[0.06] xl:block" style={{ fontSize: "6rem", letterSpacing: "0.1em" }}>
        コマスタジオ
      </span>
      <span aria-hidden className="v-text absolute left-6 bottom-24 hidden select-none font-[family-name:var(--font-mono)] text-xs tracking-[0.5em] text-crimson/40 xl:block">
        EVERY PANEL TELLS A STORY
      </span>

      <div className="relative mx-auto w-full max-w-7xl px-6 py-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="stamp animate-float">
            <span className="h-1.5 w-1.5 animate-blink bg-mint" /> 100% open source — MIT licensed
          </span>
        </motion.div>

        <motion.h1
          className="mt-8 text-[13vw] font-black uppercase leading-[0.88] tracking-tighter sm:text-7xl md:text-8xl lg:text-[7.5rem]"
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
        >
          Raw chapter,
          <br />
          <span className="relative inline-block h-[1em] min-w-[7ch] align-top">
            <AnimatePresence mode="wait">
              <motion.span
                key={i}
                className={`absolute left-0 ${WORDS[i].c}`}
                initial={{ y: "60%", opacity: 0, rotateX: 40 }}
                animate={{ y: 0, opacity: 1, rotateX: 0 }}
                exit={{ y: "-60%", opacity: 0, rotateX: -40 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {WORDS[i].w}
              </motion.span>
            </AnimatePresence>
          </span>
          <br />
          <span className="text-outline">in one studio.</span>
        </motion.h1>

        <motion.p
          className="mt-8 max-w-xl text-lg text-paper/60"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
        >
          KOMA Studio is a free, open-source scanlation pipeline — translate, clean, typeset
          and publish without leaving one window. <em className="font-[family-name:var(--font-accent)] italic text-paper">From raw to release</em>,
          owned by its community.
        </motion.p>

        <motion.div className="mt-10 flex flex-wrap items-center gap-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <StarButton />
          <a href="#download" className="btn-ghost"><Download size={18} /> Download Free</a>
          <a href="#contribute" className="group inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-paper/50 transition-colors hover:text-mint">
            or contribute <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </a>
        </motion.div>
        <motion.p className="mt-4 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-paper/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
          Windows · macOS · Linux — binaries on every release
        </motion.p>

        <motion.div className="mt-12 grid max-w-2xl grid-cols-3 gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          {STATS.map(([n, label]) => (
            <div key={label} className="glass panel-cut-sm p-5 transition-transform hover:-translate-y-1">
              <p className="text-3xl font-black text-mint">{n}</p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-paper/50">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
