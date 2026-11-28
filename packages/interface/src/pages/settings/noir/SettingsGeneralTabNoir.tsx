import { UserRound, ShieldCheck, Scale, Ticket, Globe2, Palette, Moon, Sun, Lightbulb, MousePointer2, Keyboard, RotateCcw, Film, Compass, Sparkles } from "lucide-react";
import { useBackdropVideoStore } from "@/pages/dashboard/stores/backdrop-video-store";
import { navigateToLegalDocument } from "../../../legal/navigation";
import type React from "react";
import type { AuthUser } from "../../../contexts/AuthContext";
import type { useI18n } from "../../../i18n";
import type { AppLocale } from "../../../i18n/config";
import type { KomaTheme, KomaThemeFamily } from "@koma/ui/stores/theme-store";
import { THEME_FAMILIES } from "@koma/ui/themes/registry";
import { UI_SCALE_OPTIONS, useUiScaleStore } from "@koma/ui/stores/ui-scale-store";
import type { LocalResetFeedbackState, TravelTokenMetadata } from "../settings.types";
import { shortId } from "../settings.constants";
import { Sec, Field, SpecGrid, SpecRow, Alert, ToggleRow, btnGhost, btnDanger, chip, selectCls } from "./primitives";
import { SettingsBackupsSectionNoir } from "./SettingsBackupsSectionNoir";
import { NoirAccentSectionNoir } from "./NoirAccentSectionNoir";

type TranslationFn = ReturnType<typeof useI18n>["t"];

interface SettingsGeneralTabArgs {
  t: TranslationFn;
  user: AuthUser | null;
  authLoading: boolean;
  isAuthDisabled: boolean;
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
  onOpenOnboarding?: () => void;
  onReplayTour?: () => void;
}

const UiScaleSectionNoir = ({ t }: { t: TranslationFn }): React.ReactElement => {
  const uiScale = useUiScaleStore((s) => s.uiScale);
  const compactDensity = useUiScaleStore((s) => s.compactDensity);
  return (
    <Sec icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 3h-6v2h2.59l-4.24 4.24 1.41 1.41L19 6.41V9h2V3zM3 21h6v-2H6.41l4.24-4.24-1.41-1.41L5 17.59V15H3v6z" /></svg>} title={t("settings.uiScale.title")} desc={t("settings.uiScale.description")}>
      <div className="flex flex-wrap gap-2">{UI_SCALE_OPTIONS.map((scale) => <button key={scale} type="button" aria-pressed={uiScale === scale} onClick={() => useUiScaleStore.getState().setUiScale(scale)} className={`panel-cut-sm hard-hover inline-flex items-center border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] ${uiScale === scale ? "border-crimson/60 bg-crimson/8 text-crimson" : "border-paper/12 bg-ink/50 text-paper/70"}`}>{Math.round(scale * 100)}%</button>)}</div>
      <div className="mt-4">
        <ToggleRow title={t("settings.uiScale.compactTitle")} desc={t("settings.uiScale.compactDesc")} checked={compactDensity} onChange={useUiScaleStore.getState().setCompactDensity} />
      </div>
    </Sec>
  );
};

const BackdropVideoSectionNoir = ({ t }: { t: TranslationFn }): React.ReactElement => {
  const alwaysPaused = useBackdropVideoStore((s) => s.alwaysPaused);
  return (
    <Sec icon={<Film size={14} />} title={t("settings.backdropVideo.title")} desc={t("settings.backdropVideo.description")}>
      <ToggleRow
        title={t("settings.backdropVideo.alwaysPausedTitle")}
        desc={t("settings.backdropVideo.alwaysPausedDesc")}
        checked={alwaysPaused}
        onChange={useBackdropVideoStore.getState().setAlwaysPaused} />
    </Sec>
  );
};

export const renderSettingsGeneralTabNoir = ({
  t, user, authLoading, isAuthDisabled, isDesktop, verificationBusy, handleVerify,
  profileFeedback, profileError,
  maskedDest, travelExpires, travelDuration, travelBusy, emailDeliveryEnabled,
  handleTravel, travelBlocked, travelFeedback, travelMeta, fmtDate, travelDaysLabel, travelError,
  currentTheme, setCurrentTheme, currentFamily, setCurrentFamily,
  locale, localeLabels, setLocale, supportedLocales, systemLocales,
  toolTipsEnabled, setToolTipsEnabled,
  customCursorEnabled, setCustomCursorEnabled,
  localResetBusy, handleResetLocalAppSettings, localResetFeedback,
  onOpenOnboarding, onReplayTour,
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
        <SpecRow label={t("settings.profile.accountId")} mono>{isAuthDisabled ? "—" : shortId(user?.id)}</SpecRow>
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

    {!isAuthDisabled && (
    <Sec icon={<Ticket size={14} />} title={t("settings.travel.title")}
      desc={t("settings.travel.description")}>

      <SpecGrid>
        <SpecRow label={t("settings.travel.destination")} mono>{maskedDest}</SpecRow>
        <SpecRow label={t("settings.travel.expiry")} mono>{travelExpires}</SpecRow>
        <SpecRow label={t("settings.travel.temporaryAccess")}>{travelDuration}</SpecRow>
      </SpecGrid>

      <div className="mt-3">
        <Alert tone="info">
          <strong className="text-paper">{t("settings.travel.streamLike")}</strong>
          <p className="mt-1">{t("settings.travel.streamLikeDesc")}</p>
        </Alert>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={travelBusy || !isDesktop || emailDeliveryEnabled !== true}
          onClick={() => void handleTravel()}
          className={btnGhost}
        >
          <ShieldCheck size={12} />
          {travelBusy ? <span className="blink">{t("common.sending")}</span> : t("settings.travel.sendToken")}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {travelBlocked && (
          <Alert tone={emailDeliveryEnabled === null ? "info" : "warn"}>{travelBlocked}</Alert>
        )}
        {travelFeedback && travelMeta && (
          <Alert tone="success">
            <strong className="text-paper">{travelFeedback}</strong>
            <p>{t("settings.travel.destinationPrefix", { value: travelMeta.destinationMasked })}</p>
            <p>{t("settings.travel.expirationPrefix", { value: fmtDate(travelMeta.expiresAt) })} • {t("settings.travel.accessPrefix", { value: travelDaysLabel(travelMeta.travelDays) })}</p>
          </Alert>
        )}
        {travelError && <Alert tone="error">{travelError}</Alert>}
      </div>
    </Sec>
    )}

    <Sec icon={<Globe2 size={14} />} title={t("settings.language.title")} desc={t("settings.language.description")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("settings.language.label")}>
          <select className={selectCls} value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>
            {supportedLocales.map((entry) => <option key={entry} value={entry}>{localeLabels[entry]}</option>)}
          </select>
        </Field>
        <Field label={t("settings.language.systemLabel")}>
          <p className="py-2 font-mono text-[11px] text-paper/60">
            {systemLocales.length > 0
              ? systemLocales.map((entry) => localeLabels[entry]).join(", ")
              : localeLabels[locale]}
          </p>
        </Field>
      </div>
      <p className="mt-3 font-mono text-[9px] uppercase tracking-wider text-paper/30">{t("settings.language.applied")}</p>
    </Sec>

    <Sec icon={<Palette size={14} />} title={t("settings.theme.styleLabel")} desc={t("settings.theme.styleDescription")}>
      <div className="grid gap-3 sm:grid-cols-2">
        {THEME_FAMILIES.map((family) => {
          const active = currentFamily === family.id;
          return (
            <button key={family.id} type="button" onClick={() => setCurrentFamily(family.id)}
              aria-pressed={active}
              className={`panel-cut-sm hard-hover relative flex items-center gap-3 border p-4 text-left transition-colors ${active ? "border-crimson/60 bg-crimson/8" : "border-paper/12 bg-ink/50"
                }`}>
              <span aria-hidden className={`font-display text-3xl font-black ${active ? "text-crimson" : "text-paper/15"}`}>
                {family.glyph}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-xs font-black uppercase tracking-tight text-paper">{t(family.nameKey)}</span>
                <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-wider text-paper/40">{t(family.descKey)}</span>
              </span>
              {active && <span aria-hidden className="absolute right-3 top-3 h-2 w-2 bg-crimson" />}
            </button>
          );
        })}
      </div>
    </Sec>

    <Sec icon={<Moon size={14} />} title={t("settings.theme.title")} desc={t("settings.theme.description")}>
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { id: "dark" as KomaTheme, Icon: Moon, nameKey: "settings.theme.dark", descKey: "settings.theme.darkDesc", jp: "闇" },
          { id: "light" as KomaTheme, Icon: Sun, nameKey: "settings.theme.light", descKey: "settings.theme.lightDesc", jp: "光" },
        ] as const).map((opt) => {
          const active = currentTheme === opt.id;
          return (
            <button key={opt.id} type="button" onClick={() => setCurrentTheme(opt.id)}
              aria-pressed={active}
              className={`panel-cut-sm hard-hover relative flex items-center gap-3 border p-4 text-left transition-colors ${active ? "border-crimson/60 bg-crimson/8" : "border-paper/12 bg-ink/50"
                }`}>
              <span aria-hidden className={`font-display text-3xl font-black ${active ? "text-crimson" : "text-paper/15"}`}>{opt.jp}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-display text-xs font-black uppercase tracking-tight text-paper">
                  <opt.Icon size={12} className={active ? "text-crimson" : "text-paper/40"} /> {t(opt.nameKey)}
                </span>
                <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-wider text-paper/40">{t(opt.descKey)}</span>
              </span>
              {active && <span aria-hidden className="absolute right-3 top-3 h-2 w-2 bg-crimson" />}
            </button>
          );
        })}
      </div>
    </Sec>

    <NoirAccentSectionNoir t={t} />

    <UiScaleSectionNoir t={t} />
    <Sec icon={<Lightbulb size={14} />} title={t("settings.tooltips.title")} desc={t("settings.tooltips.description")}>
      <ToggleRow
        title={t("settings.tooltips.enableTitle")}
        desc={t("settings.tooltips.enableDesc")}
        checked={toolTipsEnabled}
        onChange={setToolTipsEnabled} />
    </Sec>

    <Sec icon={<MousePointer2 size={14} />} title={t("settings.customCursor.title")} desc={t("settings.customCursor.description")}>
      <ToggleRow
        title={t("settings.customCursor.enableTitle")}
        desc={t("settings.customCursor.enableDesc")}
        checked={customCursorEnabled}
        onChange={setCustomCursorEnabled} />
    </Sec>

    <BackdropVideoSectionNoir t={t} />

    {(onOpenOnboarding || onReplayTour) && (
      <Sec icon={<Compass size={14} />} title={t("settings.onboarding.title")} desc={t("settings.onboarding.description")}>
        <div className="flex flex-wrap gap-2">
          {onOpenOnboarding && (
            <button type="button" className={btnGhost} onClick={onOpenOnboarding}>
              <Sparkles size={12} /> {t("settings.onboarding.openButton")}
            </button>
          )}
          {onReplayTour && (
            <button type="button" className={btnGhost} onClick={onReplayTour}>
              <Compass size={12} /> {t("settings.onboarding.replayTourButton")}
            </button>
          )}
        </div>
      </Sec>
    )}

    <Sec icon={<Keyboard size={14} />} title={t("settings.shortcuts.title")} desc={t("settings.shortcuts.description")}>
      <Alert tone="info">
        <strong className="text-paper">{t("settings.shortcuts.whereToEdit")}</strong>
        <p className="mt-1">
          {t("settings.shortcuts.whereToEditDesc")}{" "}
          <code className="border border-azure/30 bg-azure/10 px-1.5 py-0.5 text-azure">{t("settings.shortcuts.topbarPath")}</code>{" "}
          {t("settings.shortcuts.orPress")}{" "}
          <code className="border border-azure/30 bg-azure/10 px-1.5 py-0.5 text-azure">{t("settings.shortcuts.quickKey")}</code>.
        </p>
      </Alert>
    </Sec>

    <Sec icon={<RotateCcw size={14} />} title={t("settings.app.reset.title")} desc={t("settings.app.reset.desc")}
      className="!border-crimson/20 halftone-red">
      <button type="button" className={btnDanger} disabled={localResetBusy}
        onClick={() => void handleResetLocalAppSettings()}>
        {localResetBusy
          ? <span className="blink">{t("common.loading")}</span>
          : <><RotateCcw size={11} /> {t("settings.app.reset.button")}</>}
      </button>
      {localResetFeedback && (
        <div className="mt-3">
          <Alert tone={localResetFeedback.type === "error" ? "error" : "success"}>
            {localResetFeedback.message}
          </Alert>
        </div>
      )}
    </Sec>

    <SettingsBackupsSectionNoir t={t} />
  </div>
);
