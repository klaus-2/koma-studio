"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Hanko, PrintTicks } from "./koma-ui";
import { LegalInlineLinks } from "../../legal/LegalInlineLinks";
import { ThemeFamilySwitch } from "../ThemeFamilySwitch";
import { useI18n } from "../../../i18n";
import { AuthSideContent, ManhwaCovers } from "../AuthSideDecor";

const EASE = [0.22, 1, 0.36, 1] as const;

type AuthTab = "login" | "register";

interface AuthShellProps {
  activeTab: AuthTab;
  onSelectLogin: () => void;
  onSelectRegister: () => void;
  subtitle: string;
  children: ReactNode;
}

const MARQUEE = ["CLEAN", "REDRAW", "TRANSLATE", "TYPESET", "QC", "RELEASE", "コマ・スタジオ"];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.2 } },
};

export const AuthShellNoir = ({ activeTab, onSelectLogin, onSelectRegister, subtitle, children }: AuthShellProps) => {
  const reduced = useReducedMotion();
  const { t } = useI18n();

  return (
    <div className="koma-noir relative flex min-h-dvh overflow-hidden">
      <ThemeFamilySwitch variant="noir" />

      <main className="relative z-10 flex w-full items-center justify-center px-5 py-12 lg:w-[46%] lg:px-12">
        <div aria-hidden className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-crimson/10 blur-[130px]" />

        <motion.section
          initial={reduced ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative w-full max-w-md"
        >
          <PrintTicks />

          <div className="glass panel-cut relative p-7 sm:p-9">
            <header className="mb-7 flex items-start gap-4">
              <Hanko />
              <div>
                <h1 className="font-display text-[27px] font-black uppercase leading-none tracking-tight text-paper">
                  Koma{" "}
                  <span className="font-accent font-normal normal-case italic tracking-normal text-crimson">
                    Studio
                  </span>
                  <span className="text-gold">.</span>
                </h1>
                <p className="mt-2 max-w-[38ch] text-[13px] leading-relaxed text-paper/55">{subtitle}</p>
              </div>
            </header>

            <div
              role="tablist"
              aria-label={t("auth.tabs.ariaLabel")}
              className="panel-cut-sm mb-7 grid grid-cols-2 gap-1 border border-paper/10 bg-ink/60 p-1"
            >
              {(["login", "register"] as const).map((tab) => {
                const active = tab === activeTab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={tab === "login" ? onSelectLogin : onSelectRegister}
                    className={`panel-cut-sm relative px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] transition-colors ${active ? "text-ink" : "text-paper/45 hover:text-paper"
                      }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="koma-tab"
                        aria-hidden
                        className="absolute inset-0 bg-crimson"
                        transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
                      />
                    )}
                    <span className="relative z-10">{tab === "login" ? t("auth.tabs.login") : t("auth.tabs.register")}</span>
                  </button>
                );
              })}
            </div>

            {children}

            <footer className="mt-7 border-t border-paper/10 pt-4">
              <p className="font-mono text-[10px] leading-relaxed tracking-wide text-paper/35">
                <span aria-hidden className="mr-2 text-crimson/50">//</span>
                {t("auth.legal.reviewDocs")}{" "}
                <LegalInlineLinks className="koma-legal-inline" />
              </p>
            </footer>
          </div>
        </motion.section>
      </main>

      <aside aria-hidden className="relative hidden min-h-dvh flex-1 overflow-hidden border-l border-paper/10 lg:block">
        <video
          className="koma-bg-video"
          src="/resources/login-background.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
        />
        <div className="halftone absolute inset-0 opacity-60" />
        <div className="absolute -right-24 top-20 h-96 w-96 rounded-full bg-crimson/15 blur-[130px]" />
        <div className="absolute bottom-16 -left-16 h-80 w-80 rounded-full bg-azure/10 blur-[120px]" />

        <span className="text-outline absolute -top-10 left-8 select-none font-display text-[10rem] font-black leading-none tracking-tighter xl:text-[13rem]">
          KOMA
        </span>

        <span className="v-text absolute right-7 top-24 font-display text-sm font-bold tracking-[0.55em] text-paper/25">
          コマ・スタジオ — 漫画工房 — 第二版
        </span>

        <span className="absolute bottom-44 right-14 -rotate-12 select-none font-display text-7xl font-black text-crimson/15">
          ドドド!!
        </span>

        <motion.div
          variants={stagger}
          initial={reduced ? "show" : "hidden"}
          animate="show"
          className="relative z-10 flex h-full w-full items-center justify-center px-10"
        >
          <ManhwaCovers />

          <AuthSideContent />
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 border-t border-paper/10 bg-ink/80 py-3 backdrop-blur-sm [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.3em] text-paper/40">
            {[...MARQUEE, ...MARQUEE].map((w, i) => (
              <span key={i} className="flex items-center gap-10">
                {w} <span className="text-crimson">✕</span>
              </span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};