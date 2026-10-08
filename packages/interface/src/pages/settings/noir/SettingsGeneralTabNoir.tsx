import { UserRound, ShieldCheck, Scale } from "lucide-react";
import { navigateToLegalDocument } from "../../../legal/navigation";
import type React from "react";
import type { AuthUser } from "../../../contexts/AuthContext";
import type { useI18n } from "../../../i18n";
import { shortId } from "../settings.constants";
import { Sec, SpecGrid, SpecRow, Alert, btnGhost, chip } from "./primitives";

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
}

export const renderSettingsGeneralTabNoir = ({
  t, user, authLoading, isDesktop, verificationBusy, handleVerify,
  profileFeedback, profileError,
}: SettingsGeneralTabArgs): React.ReactElement => (
  <div className="space-y-5" key="general">
    <Sec icon={<UserRound size={14} />} title={t("settings.profile.title")}
      desc={`ID FILE · ${isDesktop ? "DESKTOP" : "WEB"} RUNTIME`}>

      <span aria-hidden className="v-text pointer-events-none absolute right-2 top-4 select-none font-display text-sm font-black text-paper/[0.05]">
        アカウント情報
      </span>

      <SpecGrid>
        <SpecRow label={t("settings.profile.name")}>{user?.name?.trim() || t("settings.profile.unspecified")}</SpecRow>
        <SpecRow label={t("settings.profile.email")}>{user?.email || "—"}</SpecRow>
        <SpecRow label={t("settings.profile.verification")}>
          <span className={chip(user?.emailVerified ? "mint" : "gold")}>
            {authLoading ? t("common.loading") : user?.emailVerified ? t("settings.profile.verified") : (
              <><span className="blink">●</span> {t("settings.profile.pending")}</>
            )}
          </span>
        </SpecRow>
        <SpecRow label={t("settings.profile.accountId")} mono>{shortId(user?.id)}</SpecRow>
        <SpecRow label={t("settings.profile.billing")} mono>
          {user?.email ? user.email.toUpperCase() : t("settings.profile.unspecified")}
        </SpecRow>
        <SpecRow label={t("settings.profile.environment")} mono>{isDesktop ? "DESKTOP" : "WEB"}</SpecRow>
      </SpecGrid>

      <div className="mt-5 flex flex-wrap gap-2">
        {!authLoading && user && !user.emailVerified && (
          <button type="button" disabled={verificationBusy} onClick={() => void handleVerify()} className={btnGhost}>
            <ShieldCheck size={12} />
            {verificationBusy ? <span className="blink">{t("common.sending")}</span> : t("settings.profile.sendVerification")}
          </button>
        )}
        <button type="button" onClick={() => navigateToLegalDocument("privacy")} className={btnGhost}>
          <Scale size={12} /> {t("settings.profile.legalCenter")}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {profileFeedback && <Alert tone="success">{profileFeedback}</Alert>}
        {profileError && <Alert tone="error">{profileError}</Alert>}
      </div>
    </Sec>
  </div>
);
