import { ReactNode, useEffect, useState } from "react";
import loginBackgroundVideo from "@koma/ui/assets/login-background.mp4";
import brandLogo from "@koma/ui/assets/logo-1.webp";
import brandLogo2 from "@koma/ui/assets/logo-2.webp";
import brandLogo3 from "@koma/ui/assets/logo-3.webp";
import brandLogo4 from "@koma/ui/assets/logo-4.webp";
import brandLogo5 from "@koma/ui/assets/logo-5.webp";
import '@koma/ui/styles/NekoLogo.css';
import cl1 from "@koma/ui/assets/cl-before.webp";
import cl2 from "@koma/ui/assets/cl-after.webp";
import tl1 from "@koma/ui/assets/tl-before.webp";
import tl2 from "@koma/ui/assets/tl-after.webp";
import rd1 from "@koma/ui/assets/cl-before-2.webp";
import rd2 from "@koma/ui/assets/cl-after-2.webp";
import aio1 from "@koma/ui/assets/aio-before.webp";
import aio2 from "@koma/ui/assets/aio-after.webp";
import { LegalInlineLinks } from "../legal/LegalInlineLinks";
import { useI18n } from "../../i18n";

type AuthTab = "login" | "register";
const DECORATIVE_MEDIA_DELAY_MS = import.meta.env.PROD ? 15_000 : 0;

interface AuthShellProps {
  activeTab: AuthTab;
  onSelectLogin: () => void;
  onSelectRegister: () => void;
  subtitle: string;
  children: ReactNode;
}

interface BrandMarkProps {
  animated?: boolean;
}

export const BrandMark = ({ animated = false }: BrandMarkProps) => (
  <div className="koma-neko is-small" aria-hidden="true">
  <img src={brandLogo} alt="" width={207} height={213} fetchPriority="high" decoding="async" />
  {animated ? (
    <>
      <img src={brandLogo2} alt="" width={207} height={213} fetchPriority="low" decoding="async" />
      <img src={brandLogo3} alt="" width={207} height={213} fetchPriority="low" decoding="async" />
      <img src={brandLogo4} alt="" width={207} height={213} fetchPriority="low" decoding="async" />
      <img src={brandLogo5} alt="" width={207} height={213} fetchPriority="low" decoding="async" />
    </>
  ) : null}
</div>
);

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

const ManhwaCovers = () => {
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
            draggable={false}
          />

          {/* BEFORE — clip-path animated overlay */}
          <div className="manhwa-float__before-wrap">
            <img
              className="manhwa-float__img manhwa-float__img--before"
              src={c.beforeImg}
              alt=""
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
};

/* ── toolkit icons (inline SVGs) ──────────────── */

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

/* ── shell ────────────────────────────────────── */

export const AuthShell = ({ activeTab, onSelectLogin, onSelectRegister, subtitle, children }: AuthShellProps) => {
  const { locale, localeLabels, setLocale, supportedLocales, t } = useI18n();
  const [showMotionBackground, setShowMotionBackground] = useState(() => DECORATIVE_MEDIA_DELAY_MS === 0);

  useEffect(() => {
    if (DECORATIVE_MEDIA_DELAY_MS === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowMotionBackground(true);
    }, DECORATIVE_MEDIA_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="auth-shell">
    {showMotionBackground ? (
      <video className="auth-shell__video" autoPlay loop muted playsInline preload="none" aria-hidden="true">
        <source src={loginBackgroundVideo} type="video/mp4" />
      </video>
    ) : null}
    <div className="auth-shell__overlay" aria-hidden="true" />
    <div className="auth-shell__halftone" aria-hidden="true" />

    <div className="auth-orb auth-orb--purple" aria-hidden="true" />
    <div className="auth-orb auth-orb--cyan" aria-hidden="true" />
    <div className="auth-orb auth-orb--rose" aria-hidden="true" />

    <span className="auth-sfx auth-sfx--1" aria-hidden="true">{t("auth.sfx.primary")}</span>
    <span className="auth-sfx auth-sfx--2" aria-hidden="true">{t("auth.sfx.secondary")}</span>

    <div className="auth-shell__layout">
      <section className="auth-shell__left">
        <div className="auth-card">
          <div className="auth-locale-switcher">
            <span className="auth-locale-switcher__icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="13" height="13" fill="currentColor">
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm5.54 7H12.8a13.96 13.96 0 00-.8-4 6.03 6.03 0 013.54 4zM10 4.06c.6.86 1.3 2.46 1.63 4.94H8.37C8.7 6.52 9.4 4.92 10 4.06zM4.46 9A6.03 6.03 0 018 5c-.41 1.09-.68 2.41-.8 4H4.46zm0 2H7.2c.12 1.59.39 2.91.8 4a6.03 6.03 0 01-3.54-4zM10 15.94c-.6-.86-1.3-2.46-1.63-4.94h3.26c-.33 2.48-1.03 4.08-1.63 4.94zM12 15c.41-1.09.68-2.41.8-4h2.74A6.03 6.03 0 0112 15z" />
              </svg>
            </span>
            <select
              className="auth-locale-switcher__select"
              value={locale}
              onChange={(event) => setLocale(event.target.value as typeof locale)}
              aria-label={t("settings.language.label")}
              title={t("settings.language.title")}
            >
              {supportedLocales.map((entry) => (
                <option key={entry} value={entry}>
                  {localeLabels[entry]}
                </option>
              ))}
            </select>
          </div>

          <header className="auth-brand">
            <span className="auth-brand__icon">
              <BrandMark animated={showMotionBackground} />
            </span>
            <div>
              <h1 className="auth-brand__title">
                {t("brand.name")}<span className="auth-brand__accent">{t("brand.studioSuffix")}</span>
                <span className="auth-brand__dot">.</span>
              </h1>
              <p className="auth-brand__subtitle">{subtitle}</p>
            </div>
          </header>

          <div className="auth-tabs" role="tablist" aria-label={t("auth.tabs.login")}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "login"}
              className={`auth-tab ${activeTab === "login" ? "auth-tab--active" : ""}`}
              onClick={onSelectLogin}
            >
              <svg className="auth-tab__icon" viewBox="0 0 20 20" width="15" height="15" fill="currentColor">
                <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-6 8a6 6 0 0112 0H4z" />
              </svg>
              {t("auth.tabs.login")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "register"}
              className={`auth-tab ${activeTab === "register" ? "auth-tab--active" : ""}`}
              onClick={onSelectRegister}
            >
              <svg className="auth-tab__icon" viewBox="0 0 20 20" width="15" height="15" fill="currentColor">
                <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
              </svg>
              {t("auth.tabs.register")}
            </button>
          </div>

          {children}

          <div className="auth-legal-footer" role="note">
            <p className="auth-note" style={{ marginTop: 18 }}>
              {t("auth.legal.reviewDocs")}
              <span className="koma-legal-inline">
                <LegalInlineLinks includeContentPolicy />
              </span>
            </p>
          </div>
        </div>
      </section>

      <aside className="auth-shell__right" aria-hidden="true">
        {showMotionBackground ? (
          <>
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
          </>
        ) : null}
      </aside>
    </div>
  </div>
  );
};
