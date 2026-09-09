import type { JSX } from "react";
import { navigateToLegalDocument } from "../../legal/navigation";
import type { AuthUser } from "../../contexts/AuthContext";
import type { useI18n } from "../../i18n";
import type { TravelTokenMetadata } from "./settings.types";
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
}

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
</div>
);
