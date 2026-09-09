"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Apple,
  Download,
  Monitor,
  Scale,
  ShieldOff,
  Terminal,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useGitHubStars } from "@/components/GitHubStars";
import { GitHubIcon } from "@/components/ui/GitHubIcon";
import { SITE_GITHUB_URL, SITE_LICENSE } from "@/lib/site";

const MangaScene = dynamic(
  () => import("./three/MangaScene").then((m) => m.MangaScene),
  { ssr: false },
);

const HERO_VIDEO_SRC = "/bg-8.mp4";
const TYPING_WORDS = ["Translate", "Clean", "Typeset", "Redraw", "Publish"];

function useTypingEffect(words: string[], typingSpeed = 100, pauseMs = 2000) {
  const [state, setState] = useState({
    display: "",
    wordIdx: 0,
    isDeleting: false,
  });

  useEffect(() => {
    const current = words[state.wordIdx];

    if (!state.isDeleting && state.display === current) {
      const timeout = setTimeout(() => {
        setState((prev) => ({ ...prev, isDeleting: true }));
      }, pauseMs);
      return () => clearTimeout(timeout);
    }

    if (state.isDeleting && state.display === "") {
      const timeout = setTimeout(() => {
        setState((prev) => ({
          display: "",
          wordIdx: (prev.wordIdx + 1) % words.length,
          isDeleting: false,
        }));
      }, typingSpeed / 2);
      return () => clearTimeout(timeout);
    }

    const delay = state.isDeleting ? typingSpeed / 2 : typingSpeed;
    const timeout = setTimeout(() => {
      setState((prev) => {
        const word = words[prev.wordIdx];
        const nextLength = prev.display.length + (prev.isDeleting ? -1 : 1);

        return {
          ...prev,
          display: word.substring(0, nextLength),
        };
      });
    }, delay);

    return () => clearTimeout(timeout);
  }, [state, words, typingSpeed, pauseMs]);

  return state.display;
}

const STATS = [
  { icon: Scale, value: SITE_LICENSE, label: "License — free forever" },
  { icon: Terminal, value: "100%", label: "Source available" },
  { icon: Monitor, value: "3", label: "Desktop platforms" },
  { icon: ShieldOff, value: "0", label: "Tracking or telemetry" },
];

export function Hero() {
  const platformHref = "/download";
  const videoRef = useRef<HTMLVideoElement>(null);
  const typedWord = useTypingEffect(TYPING_WORDS);
  const stars = useGitHubStars();

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    const video = videoRef.current;
    video.playbackRate = 0.9;

    const ensurePlayback = async () => {
      try {
        await video.play();
      } catch {
        // Background video is decorative. If autoplay is blocked,
        // the section still renders with the gradient/fx stack.
      }
    };

    void ensurePlayback();
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Media / FX stack */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <motion.video
          ref={videoRef}
          className="absolute inset-0 z-0 h-full w-full object-cover [filter:saturate(1.15)_contrast(1.08)_brightness(0.55)] mix-blend-lighten"
          src={HERO_VIDEO_SRC}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 0.34, scale: 1 }}
          transition={{ duration: 1 }}
        />

        <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_top,rgba(6,8,16,0.02),rgba(6,8,16,0.48)_42%,rgba(6,8,16,0.82)_100%)]" />
        <div className="absolute inset-0 z-20 bg-[linear-gradient(120deg,rgba(6,182,212,0.08),transparent_28%,transparent_72%,rgba(168,85,247,0.1))]" />
        <div className="absolute inset-0 z-20 bg-[linear-gradient(180deg,rgba(6,8,16,0.04)_0%,rgba(6,8,16,0.1)_30%,rgba(6,8,16,0.34)_60%,rgba(6,8,16,0.74)_100%)]" />
        <div className="absolute inset-0 z-30 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:120px_120px]" />

        <div className="absolute inset-0 z-30 opacity-85">
          <MangaScene />
        </div>

        <div className="absolute top-1/4 left-1/4 z-40 h-[500px] w-[500px] rounded-full bg-koma-purple/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 z-40 h-[400px] w-[400px] rounded-full bg-koma-cyan/8 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 text-center">
        {/* Open-source badge */}
        <Link
          href={SITE_GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-koma-purple/20 bg-koma-purple/5 backdrop-blur-sm px-5 py-2 transition-colors hover:border-koma-purple/40 hover:bg-koma-purple/10"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium tracking-wider text-koma-purple-light uppercase">
            Now open source — {SITE_LICENSE} licensed
          </span>
          <ArrowRight size={12} className="text-koma-purple-light/70" />
        </Link>

        {/* Main Headline */}
        <h1 className="mx-auto max-w-4xl font-[var(--font-display)] text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[4.5rem]">
          <span className="text-koma-text">One open-source app to </span>
          <span className="gradient-text inline-block min-w-[200px] text-left">
            {typedWord}
            <span className="ml-0.5 animate-[typing-cursor_1s_infinite] text-koma-purple">|</span>
          </span>
          <br />
          <span className="text-koma-text">Your Manga</span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-koma-text-secondary sm:text-xl">
          KŌMA Studio combines AI translation, smart typesetting, automatic cleaning, and
          inpainting redraw in one desktop app — and now the whole thing is{" "}
          <span className="text-koma-text">{SITE_LICENSE}-licensed and free forever</span>. Read the
          code, fork it, self-host it, bring your own models.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link href={platformHref} className="btn-glow flex items-center gap-2.5 px-8 py-3.5 text-base">
            <Download size={18} />
            Download — free &amp; open source
            <ArrowRight size={16} className="opacity-60" />
          </Link>
          <Link
            href={SITE_GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-koma-border-hover bg-white/[0.03] px-8 py-3.5 text-base font-medium text-koma-text transition-all hover:bg-white/[0.06] hover:border-koma-purple/30"
          >
            <GitHubIcon size={18} />
            Star on GitHub
            {stars !== null ? (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-[var(--font-mono)] text-xs text-koma-text-secondary">
                {stars >= 1000 ? `${(stars / 1000).toFixed(1).replace(/\.0$/, "")}k` : stars}
              </span>
            ) : null}
          </Link>
        </div>

        {/* Platform badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-koma-muted">
          <span className="flex items-center gap-1.5">
            <Monitor size={14} /> Windows
          </span>
          <span className="flex items-center gap-1.5">
            <Apple size={14} /> macOS
          </span>
          <span className="flex items-center gap-1.5">
            <Terminal size={14} /> Linux
          </span>
          <span className="h-3 w-px bg-white/10" aria-hidden="true" />
          <span className="font-[var(--font-mono)] text-koma-text-secondary/80">
            or build it from source
          </span>
        </div>

        {/* Stats Row */}
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="glass-card px-4 py-4 text-center">
              <Icon size={18} className="mx-auto mb-2 text-koma-purple" />
              <div className="font-[var(--font-mono)] text-xl font-bold text-koma-text">
                {value}
              </div>
              <div className="mt-1 text-xs text-koma-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
