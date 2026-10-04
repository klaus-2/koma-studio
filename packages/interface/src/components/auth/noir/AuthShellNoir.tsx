import { memo, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Hanko, PrintTicks } from "./koma-ui";
import { LegalInlineLinks } from "../../legal/LegalInlineLinks";
import { ThemeFamilySwitch } from "../ThemeFamilySwitch";
import { useI18n } from "../../../i18n";

const EASE = [0.22, 1, 0.36, 1] as const;

type AuthTab = "login" | "register";

interface AuthShellProps {
  activeTab: AuthTab;
  onSelectLogin: () => void;
  onSelectRegister: () => void;
  subtitle: string;
  children: ReactNode;
}

const PIPELINE = [
  { step: "01 · RAW", status: "done" },
  { step: "02 · CLEAN", status: "done" },
  { step: "03 · REDRAW", status: "done" },
  { step: "04 · TRANSLATE", status: "active" },
  { step: "05 · TYPESET", status: "todo" },
  { step: "06 · QC / RELEASE", status: "todo" },
] as const;

const MARQUEE = ["CLEAN", "REDRAW", "TRANSLATE", "TYPESET", "QC", "RELEASE", "コマ・スタジオ"];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.2 } },
};
const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

const NoirAuthAside = memo(function NoirAuthAside() {
  const { t } = useI18n();
  const reduced = useReducedMotion();

  const stats = [
    { value: t("auth.stats.activeScanlatorsValue"), label: t("auth.stats.activeScanlators") },
    { value: t("auth.stats.toolsValue"), label: t("auth.stats.tools") },
    { value: t("auth.stats.pagesProcessedValue"), label: t("auth.stats.pagesProcessed") },
  ];

  return (
    <aside aria-hidden className="relative hidden min-h-dvh flex-1 overflow-hidden border-l border-paper/10 lg:block">
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
        className="relative z-10 mx-auto grid h-full max-w-xl grid-cols-2 content-center gap-4 px-10 pb-24 pt-16"
      >
        <motion.figure variants={item} className="glass panel-cut col-span-2 p-6">
          <span className="kicker">// {t("auth.noir.manifesto")}</span>
          <blockquote className="mt-3 font-accent text-[26px] italic leading-snug text-paper">
            &ldquo;{t("auth.quote.line1")} {t("auth.quote.line2")}{" "}
            <span className="text-crimson">{t("auth.quote.line3")}</span>
            &rdquo;
          </blockquote>
          <figcaption className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-paper/40">
            {t("auth.noir.manifestoCaption")}
          </figcaption>
        </motion.figure>

        <motion.div variants={item} className="glass panel-cut-sm p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="kicker">// {t("auth.noir.pipeline")}</span>
            <span className="stamp panel-cut-sm">{t("auth.noir.live")}</span>
          </div>
          <ul className="space-y-2.5 font-mono text-[11px] uppercase tracking-[0.12em]">
            {PIPELINE.map((p) => (
              <li key={p.step} className="flex items-center gap-2.5">
                {p.status === "done" && <span className="text-mint">▣</span>}
                {p.status === "active" && <span className="animate-blink text-crimson">●</span>}
                {p.status === "todo" && <span className="text-paper/25">▢</span>}
                <span
                  className={
                    p.status === "active"
                      ? "text-paper"
                      : p.status === "done"
                        ? "text-paper/60"
                        : "text-paper/30"
                  }
                >
                  {p.step}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div variants={item} className="glass panel-cut-sm relative h-full min-h-[210px] overflow-hidden">
          <div className="absolute inset-0 grid place-items-center bg-ink-3">
            <div className="halftone absolute inset-0 opacity-70" />
            <div className="panel-cut-sm relative border border-mint/50 bg-ink px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mint">
              {t("auth.noir.pageClean")}
            </div>
          </div>
          <div className="absolute inset-0 animate-wipe">
            <div className="absolute inset-0 grid place-items-center bg-ink-2">
              <div className="halftone-red absolute inset-0 opacity-80" />
              <div className="relative -rotate-3 border border-crimson/50 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-crimson/80">
                生原稿 / Raw
              </div>
            </div>
          </div>
          <span className="absolute left-3 top-3 z-10 font-mono text-[9px] uppercase tracking-[0.25em] text-paper/50">
            {t("auth.noir.beforeAfter")}
          </span>
          <span className="absolute bottom-3 right-3 z-10 font-mono text-[9px] uppercase tracking-[0.25em] text-gold">
            {t("auth.noir.autoClean")}
          </span>
        </motion.div>

        <motion.div variants={item} className="glass panel-cut-sm col-span-2 grid grid-cols-3 divide-x divide-paper/10">
          {stats.map((s) => (
            <div key={s.label} className="px-5 py-4">
              <p className="font-display text-2xl font-black tracking-tight text-paper">{s.value}</p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-paper/45">{s.label}</p>
            </div>
          ))}
        </motion.div>
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
  );
});

export const AuthShellNoir = ({ activeTab, onSelectLogin, onSelectRegister, subtitle, children }: AuthShellProps) => {
  const { t, locale, localeLabels, setLocale, supportedLocales } = useI18n();
  const reduced = useReducedMotion();

  return (
    <div className="koma-noir relative flex min-h-dvh overflow-hidden">
      <ThemeFamilySwitch variant="noir" />

      {/* ════════ ESQUERDA — a página do formulário ════════ */}
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
            <div className="mb-7 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-paper/40">
              <span>
                <span className="text-crimson">{t("auth.noir.cap")}</span>{" "}
                {activeTab === "login" ? `01 — ${t("auth.tabs.login")}` : `02 — ${t("auth.tabs.register")}`}
              </span>
              <span className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-1.5 w-1.5 animate-blink bg-crimson" />
                {t("auth.noir.serverOnline")}
              </span>
            </div>

            <header className="mb-7 flex items-start gap-4">
              <Hanko />
              <div>
                <h1 className="font-display text-[27px] font-black uppercase leading-none tracking-tight text-paper">
                  {t("brand.name")}{" "}
                  <span className="font-accent font-normal normal-case italic tracking-normal text-crimson">
                    {t("brand.studioSuffix")}
                  </span>
                  <span className="text-gold">.</span>
                </h1>
                <p className="mt-2 max-w-[38ch] text-[13px] leading-relaxed text-paper/55">{subtitle}</p>
              </div>
            </header>

            <div
              role="tablist"
              aria-label={t("auth.tabs.login")}
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

            <footer className="mt-7 flex items-center justify-between gap-3 border-t border-paper/10 pt-4">
              <p className="font-mono text-[10px] leading-relaxed tracking-wide text-paper/35">
                {t("auth.legal.reviewDocs")}{" "}
                <span className="koma-legal-inline">
                  <LegalInlineLinks />
                </span>
              </p>
              <select
                className="shrink-0 border border-paper/20 bg-transparent px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-paper/60"
                value={locale}
                onChange={(event) => setLocale(event.target.value as typeof locale)}
                aria-label={t("settings.language.label")}
                title={t("settings.language.title")}
              >
                {supportedLocales.map((entry) => (
                  <option key={entry} value={entry} className="text-ink">
                    {localeLabels[entry]}
                  </option>
                ))}
              </select>
            </footer>
          </div>
        </motion.section>
      </main>

      <NoirAuthAside />
    </div>
  );
};
