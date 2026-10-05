import { memo, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import cl1 from "@koma/ui/assets/cl-before.webp";
import cl2 from "@koma/ui/assets/cl-after.webp";
import tl1 from "@koma/ui/assets/tl-before.webp";
import tl2 from "@koma/ui/assets/tl-after.webp";
import rd1 from "@koma/ui/assets/cl-before-2.webp";
import rd2 from "@koma/ui/assets/cl-after-2.webp";
import aio1 from "@koma/ui/assets/aio-before.webp";
import aio2 from "@koma/ui/assets/aio-after.webp";
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

const MARQUEE = ["CLEAN", "REDRAW", "TRANSLATE", "TYPESET", "QC", "RELEASE", "コマ・スタジオ"];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.2 } },
};

/* ── cover config ─────────────────────────────── */

interface CoverConfig {
  id: string;
  badge?: string;
  badgeNew?: boolean;
  title: string;
  subtitle: string;
  beforeImg: string;
  afterImg: string;
}

/* ── floating covers with before/after slider ─── */

const ManhwaCovers = memo(function ManhwaCovers() {
  const { t } = useI18n();

  const covers: CoverConfig[] = [
    {
      id: "1",
      badge: t("auth.cover.popular"),
      title: t("auth.cover.cleanRedraw"),
      subtitle: "",
      beforeImg: cl1,
      afterImg: cl2,
    },
    {
      id: "2",
      title: t("auth.cover.translation"),
      subtitle: "",
      beforeImg: tl1,
      afterImg: tl2,
    },
    {
      id: "3",
      badge: t("auth.cover.new"),
      badgeNew: true,
      title: t("auth.cover.typography"),
      subtitle: "",
      beforeImg: cl2,
      afterImg: cl1,
    },
    {
      id: "4",
      title: t("auth.cover.fullEditing"),
      subtitle: t("auth.cover.allInOne"),
      beforeImg: aio1,
      afterImg: aio2,
    },
    {
      id: "5",
      title: t("auth.cover.finalQc"),
      subtitle: "",
      beforeImg: rd1,
      afterImg: rd2,
    },
  ];

  return (
    <>
      {covers.map((c) => (
        <div key={c.id} className={`manhwa-float manhwa-float--${c.id}`} aria-hidden="true">
          {/* ── image comparison slider ── */}
          <div className="manhwa-float__preview">
            {/* AFTER — base layer (full card) */}
            <img
              className="manhwa-float__img manhwa-float__img--after"
              src={c.afterImg}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />

            {/* BEFORE — clip-path animated overlay */}
            <div className="manhwa-float__before-wrap">
              <img
                className="manhwa-float__img manhwa-float__img--before"
                src={c.beforeImg}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </div>

            {/* Slider bar + handle */}
            <div className="manhwa-float__bar">
              <span className="manhwa-float__handle" />
            </div>
          </div>

          <div className="manhwa-float__gradient" />

          {c.badge && (
            <div className={`manhwa-float__badge${c.badgeNew ? " manhwa-float__badge--new" : ""}`}>
              {c.badge}
            </div>
          )}

          <div className="manhwa-float__bottom">
            <span className="manhwa-float__title">{c.title}</span>
            <span className="manhwa-float__subtitle">{c.subtitle}</span>
          </div>
        </div>
      ))}
    </>
  );
});

/* ── toolkit icons (inline SVGs, same set as the classic shell) ── */

const IconAI = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1zm4.5 7l.75 1.75L15 10.5l-1.75.75L12.5 13l-.75-1.75L10 10.5l1.75-.75L12.5 8zM3 10l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
  </svg>
);

const IconTools = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M12.1 3.9a4 4 0 00-5.3.5L4.5 6.7a1 1 0 000 1.4l3.4 3.4a1 1 0 001.4 0l2.3-2.3a4 4 0 00.5-5.3l-1.8 1.8-1.4-1.4 1.8-1.8zM2 13l2.5-2.5 1 1L3 14a.7.7 0 01-1-1z" />
  </svg>
);

const IconBook = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2.5A1.5 1.5 0 013.5 1h4a.5.5 0 01.5.5V6l-1.3-.9a.5.5 0 00-.6 0L5 6V1.5H3.5a.5.5 0 000 1H4v9H3.5A1.5 1.5 0 012 10V2.5zM3.5 12H12v-1H3.5a.5.5 0 000 1zM5 1h7.5A1.5 1.5 0 0114 2.5v8a1.5 1.5 0 01-1.5 1.5H3.5A1.5 1.5 0 012 10.5V12h10V2H5v-.5a.5.5 0 00-.08-.28z" />
  </svg>
);

const NoirAuthAside = memo(function NoirAuthAside() {
  const { t } = useI18n();
  const reduced = useReducedMotion();

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
        className="relative z-10 flex h-full w-full items-center justify-center px-10"
      >
        <ManhwaCovers />

        <div className="auth-right-content">
          <blockquote className="auth-quote">
            <span className="auth-quote__mark">&ldquo;</span>
            {t("auth.quote.line1")}
            <br />
            {t("auth.quote.line2")}
            <br />
            {t("auth.quote.line3")}
          </blockquote>

          {/* ── Stats ── */}
          <div className="auth-stats">
            <div className="auth-stat">
              <span className="auth-stat__number">{t("auth.stats.activeScanlatorsValue")}</span>
              <span className="auth-stat__label">{t("auth.stats.activeScanlators")}</span>
            </div>
            <div className="auth-stat__sep" />
            <div className="auth-stat">
              <span className="auth-stat__number">{t("auth.stats.toolsValue")}</span>
              <span className="auth-stat__label">{t("auth.stats.tools")}</span>
            </div>
            <div className="auth-stat__sep" />
            <div className="auth-stat">
              <span className="auth-stat__number">{t("auth.stats.pagesProcessedValue")}</span>
              <span className="auth-stat__label">{t("auth.stats.pagesProcessed")}</span>
            </div>
          </div>

          {/* ── Toolkit tags (organized) ── */}
          <div className="auth-toolkit">
            <div className="auth-toolkit__group">
              <span className="auth-toolkit__label">
                <IconAI />
                {t("auth.toolkit.ai")}
              </span>
              <div className="auth-toolkit__tags">
                <span className="auth-genre auth-genre--purple">{t("auth.toolkit.aiClean")}</span>
                <span className="auth-genre auth-genre--purple">{t("auth.toolkit.aiTranslation")}</span>
                <span className="auth-genre auth-genre--cyan">{t("auth.toolkit.autoRedraw")}</span>
              </div>
            </div>

            <div className="auth-toolkit__group">
              <span className="auth-toolkit__label">
                <IconTools />
                {t("auth.toolkit.tools")}
              </span>
              <div className="auth-toolkit__tags">
                <span className="auth-genre auth-genre--rose">{t("auth.toolkit.advancedEditor")}</span>
                <span className="auth-genre auth-genre--rose">{t("auth.toolkit.proTypesetting")}</span>
                <span className="auth-genre auth-genre--amber">{t("auth.toolkit.qualityControl")}</span>
              </div>
            </div>

            <div className="auth-toolkit__group">
              <span className="auth-toolkit__label">
                <IconBook />
                {t("auth.toolkit.learning")}
              </span>
              <div className="auth-toolkit__tags">
                <span className="auth-genre auth-genre--emerald">{t("auth.toolkit.guides")}</span>
                <span className="auth-genre auth-genre--amber">{t("auth.toolkit.resources")}</span>
              </div>
            </div>
          </div>

          <div className="auth-community">
            <div className="auth-community__avatars">
              <span className="auth-avatar auth-avatar--1" />
              <span className="auth-avatar auth-avatar--2" />
              <span className="auth-avatar auth-avatar--3" />
              <span className="auth-avatar auth-avatar--4" />
              <span className="auth-avatar auth-avatar--join">{t("auth.community.joinIndicator")}</span>
            </div>
            <p className="auth-community__label">{t("auth.community.join")}</p>
          </div>
        </div>
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