import { ReactNode, useEffect, useState } from "react";
import loginBackgroundVideo from "@koma/ui/assets/login-background.mp4";
import loginBackgroundPoster from "@koma/ui/assets/login-background-poster.webp";
import brandLogo from "@koma/ui/assets/logo-1.webp";
import brandLogo2 from "@koma/ui/assets/logo-2.webp";
import brandLogo3 from "@koma/ui/assets/logo-3.webp";
import brandLogo4 from "@koma/ui/assets/logo-4.webp";
import brandLogo5 from "@koma/ui/assets/logo-5.webp";
import '@koma/ui/styles/NekoLogo.css';
import { LegalInlineLinks } from "../legal/LegalInlineLinks";
import { useI18n } from "../../i18n";
import { ThemeFamilySwitch } from "./ThemeFamilySwitch";
import { AuthSideContent, ManhwaCovers } from "./AuthSideDecor";

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

/* ── shell ────────────────────────────────────── */

export const AuthShellClassic = ({ activeTab, onSelectLogin, onSelectRegister, subtitle, children }: AuthShellProps) => {
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
    <ThemeFamilySwitch variant="classic" />
    {showMotionBackground ? (
      <video className="auth-shell__video" autoPlay loop muted playsInline preload="none" poster={loginBackgroundPoster} aria-hidden="true">
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

            <AuthSideContent />
          </>
        ) : null}
      </aside>
    </div>
  </div>
  );
};
