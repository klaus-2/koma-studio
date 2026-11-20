import type { JSX } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { navigateToLegalDocument } from "../../legal/navigation";
import type { AuthUser } from "../../contexts/AuthContext";
import type { useI18n } from "../../i18n";
import type { AppLocale } from "../../i18n/config";
import type { KomaTheme, KomaThemeFamily } from "@koma/ui/stores/theme-store";
import { THEME_FAMILIES } from "@koma/ui/themes/registry";
import { UI_SCALE_OPTIONS, useUiScaleStore } from "@koma/ui/stores/ui-scale-store";
import type { LocalResetFeedbackState, TravelTokenMetadata } from "./settings.types";
import { shortId } from "./settings.constants";

type TranslationFn = ReturnType<typeof useI18n>["t"];

interface SettingsGeneralTabArgs {
  t: TranslationFn;
  user: AuthUser | null;
  authLoading: boolean;
  isDesktop: boolean;
  verificationBusy: boolean;
  handleVerify: () => Promise<void>;
  profileFeedback: string | null;
  profileError: string | null;
  maskedDest: string;
  travelExpires: string;
  travelDuration: string;
  travelBusy: boolean;
  emailDeliveryEnabled: boolean | null;
  handleTravel: () => Promise<void>;
  travelBlocked: string | null;
  travelFeedback: string | null;
  travelMeta: TravelTokenMetadata | null;
  fmtDate: (value: number | string | null) => string;
  travelDaysLabel: (value: number | null) => string;
  travelError: string | null;
  currentTheme: KomaTheme;
  setCurrentTheme: (theme: KomaTheme) => void;
  currentFamily: KomaThemeFamily;
  setCurrentFamily: (family: KomaThemeFamily) => void;
  locale: AppLocale;
  localeLabels: Record<AppLocale, string>;
  setLocale: (locale: AppLocale) => void;
  supportedLocales: readonly AppLocale[];
  systemLocales: AppLocale[];
  toolTipsEnabled: boolean;
  setToolTipsEnabled: (enabled: boolean) => void;
  customCursorEnabled: boolean;
  setCustomCursorEnabled: (enabled: boolean) => void;
  localResetBusy: boolean;
  handleResetLocalAppSettings: () => Promise<void>;
  localResetFeedback: LocalResetFeedbackState;
}

// UI scale (90/100/125/150%) + compact density — applies live via applyUiScale (App mount).
const UiScaleSection = ({ t }: { t: TranslationFn }): JSX.Element => {
  const uiScale = useUiScaleStore((s) => s.uiScale);
  const compactDensity = useUiScaleStore((s) => s.compactDensity);
  return (<section className="koma-stg-section">
    <div className="koma-stg-section__head"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="koma-stg-section__ico"><path d="M21 3h-6v2h2.59l-4.24 4.24 1.41 1.41L19 6.41V9h2V3zM3 21h6v-2H6.41l4.24-4.24-1.41-1.41L5 17.59V15H3v6z" /></svg><h3 className="koma-stg-section__title">{t("settings.uiScale.title")}</h3></div>
    <p className="koma-stg-section__desc">{t("settings.uiScale.description")}</p>
    <div className="koma-stg-actions">
      {UI_SCALE_OPTIONS.map((scale) => <button key={scale} type="button" aria-pressed={uiScale === scale} className={`koma-btn ${uiScale === scale ? "koma-btn--primary" : "koma-btn--ghost"}`} onClick={() => useUiScaleStore.getState().setUiScale(scale)}>{Math.round(scale * 100)}%</button>)}
    </div>
    <label className="koma-stg-toggle-wide" style={{ marginTop: 14 }}>
      <div><span className="koma-stg-toggle-wide__title">{t("settings.uiScale.compactTitle")}</span><p className="koma-stg-toggle-wide__desc">{t("settings.uiScale.compactDesc")}</p></div>
      <div className={`koma-toggle ${compactDensity ? "koma-toggle--on" : ""}`}><input type="checkbox" className="koma-toggle__input" checked={compactDensity} onChange={(e) => useUiScaleStore.getState().setCompactDensity(e.target.checked)} /><span className="koma-toggle__track"><span className="koma-toggle__thumb" /></span></div>
    </label>
  </section>);
};

export const renderSettingsGeneralTab = ({
  t,
  user,
  authLoading,
  isDesktop,
  verificationBusy,
  handleVerify,
  profileFeedback,
  profileError,
  maskedDest,
  travelExpires,
  travelDuration,
  travelBusy,
  emailDeliveryEnabled,
  handleTravel,
  travelBlocked,
  travelFeedback,
  travelMeta,
  fmtDate,
  travelDaysLabel,
  travelError,
  currentTheme,
  setCurrentTheme,
  currentFamily,
  setCurrentFamily,
  locale,
  localeLabels,
  setLocale,
  supportedLocales,
  systemLocales,
  toolTipsEnabled,
  setToolTipsEnabled,
  customCursorEnabled,
  setCustomCursorEnabled,
  localResetBusy,
  handleResetLocalAppSettings,
  localResetFeedback,
}: SettingsGeneralTabArgs): JSX.Element => (
<div className="koma-stg-panel" key="general">
  {/* Profile Section */}
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path fillRule="evenodd" d="M10 2a5 5 0 100 10 5 5 0 000-10zM3 15a7 7 0 1114 0v1a1 1 0 11-2 0v-1a5 5 0 00-10 0v1a1 1 0 11-2 0v-1z" clipRule="evenodd" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.profile.title")}</h3>
    </div>

    <div className="koma-stg-grid">
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.profile.name")}</span>
        <span className="koma-stg-item__value">{user?.name?.trim() || t("settings.profile.unspecified")}</span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.profile.email")}</span>
        <span className="koma-stg-item__value">{user?.email || "—"}</span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.profile.verification")}</span>
        <span className={`koma-stg-chip ${user?.emailVerified ? "koma-stg-chip--ok" : "koma-stg-chip--warn"}`}>
          {authLoading ? t("common.loading") : user?.emailVerified ? t("settings.profile.verified") : t("settings.profile.pending")}
        </span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.profile.accountId")}</span>
        <span className="koma-stg-item__value koma-stg-item__value--mono">{shortId(user?.id)}</span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.profile.environment")}</span>
        <span className="koma-stg-item__value">{isDesktop ? "Desktop" : "Web"}</span>
      </div>
    </div>

    <div className="koma-stg-actions">
      {!authLoading && user && !user.emailVerified && (
        <button type="button" disabled={verificationBusy} onClick={() => void handleVerify()} className="koma-btn koma-btn--ghost">
          {verificationBusy && <span className="auth-spinner" />}
          {verificationBusy ? t("common.sending") : t("settings.profile.sendVerification")}
        </button>
      )}
      <button type="button" onClick={() => navigateToLegalDocument("privacy")} className="koma-btn koma-btn--ghost">
        {t("settings.profile.legalCenter")}
      </button>
    </div>

    {profileFeedback && (
      <div className="koma-stg-alert koma-stg-alert--success" role="status">
        <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        <span>{profileFeedback}</span>
      </div>
    )}
    {profileError && (
      <div className="koma-stg-alert koma-stg-alert--error" role="alert">
        <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
        <span>{profileError}</span>
      </div>
    )}
  </section>

  {/* Travel Token Section */}
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path fillRule="evenodd" d="M10 2a3 3 0 00-3 3v1H6a2 2 0 00-2 2v2a6 6 0 1012 0V8a2 2 0 00-2-2h-1V5a3 3 0 00-3-3zm1 4H9V5a1 1 0 112 0v1zm-1 4a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.travel.title")}</h3>
    </div>
    <p className="koma-stg-section__desc">
      {t("settings.travel.description")}
    </p>

    <div className="koma-stg-grid">
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.travel.destination")}</span>
        <span className="koma-stg-item__value">{maskedDest}</span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.travel.expiry")}</span>
        <span className="koma-stg-item__value">{travelExpires}</span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.travel.temporaryAccess")}</span>
        <span className="koma-stg-item__value">{travelDuration}</span>
      </div>
    </div>

    <div className="koma-stg-alert koma-stg-alert--info" role="note">
      <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
      <div>
        <strong>{t("settings.travel.streamLike")}</strong>
        <p>{t("settings.travel.streamLikeDesc")}</p>
      </div>
    </div>

    <div className="koma-stg-actions">
      <button
        type="button"
        disabled={travelBusy || !isDesktop || emailDeliveryEnabled !== true}
        onClick={() => void handleTravel()}
        className="koma-btn koma-btn--ghost"
      >
        {travelBusy && <span className="auth-spinner" />}
        {travelBusy ? t("common.sending") : t("settings.travel.sendToken")}
      </button>
    </div>

    {travelBlocked && (
      <div className={`koma-stg-alert ${emailDeliveryEnabled === null ? "koma-stg-alert--info" : "koma-stg-alert--warn"}`} role="status">
        <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.647-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
        <span>{travelBlocked}</span>
      </div>
    )}

    {travelFeedback && travelMeta && (
      <div className="koma-stg-alert koma-stg-alert--success" role="status">
        <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        <div>
          <strong>{travelFeedback}</strong>
          <p>{t("settings.travel.destinationPrefix", { value: travelMeta.destinationMasked })}</p>
          <p>{t("settings.travel.expirationPrefix", { value: fmtDate(travelMeta.expiresAt) })} • {t("settings.travel.accessPrefix", { value: travelDaysLabel(travelMeta.travelDays) })}</p>
        </div>
      </div>
    )}
    {travelError && (
      <div className="koma-stg-alert koma-stg-alert--error" role="alert">
        <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
        <span>{travelError}</span>
      </div>
    )}
  </section>

  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm5.54 7H12.8a13.96 13.96 0 00-.8-4 6.03 6.03 0 013.54 4zM10 4.06c.6.86 1.3 2.46 1.63 4.94H8.37C8.7 6.52 9.4 4.92 10 4.06zM4.46 9A6.03 6.03 0 018 5c-.41 1.09-.68 2.41-.8 4H4.46zm0 2H7.2c.12 1.59.39 2.91.8 4a6.03 6.03 0 01-3.54-4zM10 15.94c-.6-.86-1.3-2.46-1.63-4.94h3.26c-.33 2.48-1.03 4.08-1.63 4.94zM12 15c.41-1.09.68-2.41.8-4h2.74A6.03 6.03 0 0112 15z" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.language.title")}</h3>
    </div>
    <p className="koma-stg-section__desc">{t("settings.language.description")}</p>

    <div className="koma-stg-grid">
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.language.label")}</span>
        <select
          className="koma-ig-field__select"
          value={locale}
          onChange={(event) => setLocale(event.target.value as typeof locale)}
          style={{ marginTop: 8 }}
        >
          {supportedLocales.map((entry) => (
            <option key={entry} value={entry}>
              {localeLabels[entry]}
            </option>
          ))}
        </select>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.language.systemLabel")}</span>
        <span className="koma-stg-item__value">
          {systemLocales.length > 0
            ? systemLocales.map((entry) => localeLabels[entry]).join(", ")
            : localeLabels[locale]}
        </span>
      </div>
    </div>

    <p className="koma-stg-section__desc" style={{ marginTop: 12 }}>
      {t("settings.language.applied")}
    </p>
  </section>

  {/* Theme Family Selector (design system: classic / noir) */}
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm11.5 0L18 16.5 20.5 14 22 15.5 18 19.5 14 15.5 15.5 14z" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.theme.styleLabel")}</h3>
    </div>
    <p className="koma-stg-section__desc">{t("settings.theme.styleDescription")}</p>

    <div className="koma-stg-themes">
      {THEME_FAMILIES.map((family) => (
        <button
          key={family.id}
          type="button"
          className={`koma-stg-theme ${currentFamily === family.id ? "koma-stg-theme--active" : ""}`}
          onClick={() => setCurrentFamily(family.id)}
        >
          <div className={`koma-stg-theme__preview koma-stg-theme__preview--${family.id}`}>
            {family.glyph}
          </div>
          <div className="koma-stg-theme__info">
            <span className="koma-stg-theme__name">{t(family.nameKey)}</span>
            <span className="koma-stg-theme__desc">{t(family.descKey)}</span>
          </div>
        </button>
      ))}
    </div>
  </section>

  {/* Theme Selector */}
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.theme.title")}</h3>
    </div>
    <p className="koma-stg-section__desc">{t("settings.theme.description")}</p>

    <div className="koma-stg-themes">
      {([
        { id: "dark" as KomaTheme, icon: "\u{1F319}", nameKey: "settings.theme.dark", descKey: "settings.theme.darkDesc" },
        { id: "light" as KomaTheme, icon: "\u{2600}\u{FE0F}", nameKey: "settings.theme.light", descKey: "settings.theme.lightDesc" },
      ] as const).map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`koma-stg-theme ${currentTheme === opt.id ? "koma-stg-theme--active" : ""}`}
          onClick={() => setCurrentTheme(opt.id)}
        >
          <div className={`koma-stg-theme__preview koma-stg-theme__preview--${opt.id}`}>
            {opt.icon}
          </div>
          <div className="koma-stg-theme__info">
            <span className="koma-stg-theme__name">{t(opt.nameKey)}</span>
            <span className="koma-stg-theme__desc">{t(opt.descKey)}</span>
          </div>
        </button>
      ))}
    </div>
  </section>

  {/* UI Scale & Density */}
  <UiScaleSection t={t} />
  {/* Tool Tips */}
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path d="M11 3a1 1 0 100 2h.324a6.452 6.452 0 00-.831 2.475 4.952 4.952 0 00-3.428 2.852A3.978 3.978 0 005 14a1 1 0 102 0 1.98 1.98 0 011.667-1.963 1 1 0 00.82-.716A4.471 4.471 0 0112.093 9h.407a1 1 0 00.98-.817l.02-.1A6.5 6.5 0 0011 3z" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.tooltips.title")}</h3>
    </div>
    <p className="koma-stg-section__desc">
      {t("settings.tooltips.description")}
    </p>

    <label className="koma-stg-toggle-wide">
      <div>
        <span className="koma-stg-toggle-wide__title">{t("settings.tooltips.enableTitle")}</span>
        <p className="koma-stg-toggle-wide__desc">
          {t("settings.tooltips.enableDesc")}
        </p>
      </div>
      <div className={`koma-toggle ${toolTipsEnabled ? "koma-toggle--on" : ""}`}>
        <input
          type="checkbox"
          className="koma-toggle__input"
          checked={toolTipsEnabled}
          onChange={(e) => setToolTipsEnabled(e.target.checked)}
        />
        <span className="koma-toggle__track">
          <span className="koma-toggle__thumb" />
        </span>
      </div>
    </label>
  </section>

  {/* Custom Cursor */}
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.customCursor.title")}</h3>
    </div>
    <p className="koma-stg-section__desc">
      {t("settings.customCursor.description")}
    </p>

    <label className="koma-stg-toggle-wide">
      <div>
        <span className="koma-stg-toggle-wide__title">{t("settings.customCursor.enableTitle")}</span>
        <p className="koma-stg-toggle-wide__desc">
          {t("settings.customCursor.enableDesc")}
        </p>
      </div>
      <div className={`koma-toggle ${customCursorEnabled ? "koma-toggle--on" : ""}`}>
        <input
          type="checkbox"
          className="koma-toggle__input"
          checked={customCursorEnabled}
          onChange={(e) => setCustomCursorEnabled(e.target.checked)}
        />
        <span className="koma-toggle__track">
          <span className="koma-toggle__thumb" />
        </span>
      </div>
    </label>
  </section>

  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path d="M3 5.5A2.5 2.5 0 015.5 3h9A2.5 2.5 0 0117 5.5v9a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 013 14.5v-9zm3.25 1a.75.75 0 00-.75.75v1.5c0 .414.336.75.75.75h1.5A.75.75 0 008.5 8.75v-1.5a.75.75 0 00-.75-.75h-1.5zm5 0a.75.75 0 00-.75.75v1.5c0 .414.336.75.75.75h2.5a.75.75 0 000-1.5H12V7.25a.75.75 0 00-.75-.75zM6.25 11a.75.75 0 00-.75.75v1.5c0 .414.336.75.75.75h7.5a.75.75 0 000-1.5H7V11.75a.75.75 0 00-.75-.75z" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.shortcuts.title")}</h3>
    </div>
    <p className="koma-stg-section__desc">
      {t("settings.shortcuts.description")}
    </p>

    <div className="auth-alert auth-alert--info" role="status" style={{ marginTop: 14 }}>
      <span aria-hidden="true" style={{ fontWeight: 700 }}>{t("common.infoGlyph")}</span>
      <div>
        <strong>{t("settings.shortcuts.whereToEdit")}</strong>
        <p style={{ margin: "4px 0 0" }}>
          {t("settings.shortcuts.whereToEditDesc")} <code>{t("settings.shortcuts.topbarPath")}</code> {t("settings.shortcuts.orPress")} <code>{t("settings.shortcuts.quickKey")}</code>.
        </p>
      </div>
    </div>
  </section>

  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm2.24-10.76a.75.75 0 10-1.06-1.06L10 7.44 8.82 6.26a.75.75 0 10-1.06 1.06L8.94 8.5 7.76 9.68a.75.75 0 101.06 1.06L10 9.56l1.18 1.18a.75.75 0 101.06-1.06L11.06 8.5l1.18-1.18z" clipRule="evenodd" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.app.reset.title")}</h3>
    </div>
    <p className="koma-stg-section__desc">
      {t("settings.app.reset.desc")}
    </p>

    <div className="koma-stg-actions koma-stg-actions--row" style={{ marginTop: 16 }}>
      <button
        type="button"
        className="koma-btn koma-btn--ghost koma-btn--sm"
        disabled={localResetBusy}
        onClick={() => void handleResetLocalAppSettings()}
      >
        {localResetBusy ? (
          <><span className="auth-spinner" /> {t("common.loading")}</>
        ) : (
          <><RotateCcw size={11} /> {t("settings.app.reset.button")}</>
        )}
      </button>
    </div>

    {localResetFeedback && (
      <div
        className={`koma-stg-alert ${localResetFeedback.type === "error" ? "koma-stg-alert--error" : "koma-stg-alert--success"}`}
        role={localResetFeedback.type === "error" ? "alert" : "status"}
        style={{ marginTop: 14 }}
      >
        {localResetFeedback.type === "error" ? (
          <AlertTriangle size={11} />
        ) : (
          <CheckCircle2 size={11} />
        )}
        <span>{localResetFeedback.message}</span>
      </div>
    )}
  </section>
</div>
);
