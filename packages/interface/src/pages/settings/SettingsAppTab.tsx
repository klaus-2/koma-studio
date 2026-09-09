import type { JSX } from "react";
import type { Dispatch, SetStateAction } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";

import RuntimeProfileSection from "../../components/runtime/RuntimeProfileSection";
import { ReleaseNotesMarkdown } from "../../components/updater/ReleaseNotesMarkdown";
import type { AppLocale } from "../../i18n/config";
import type { useI18n } from "../../i18n";
import type { UseUpdaterApi } from "../../hooks/useUpdater";
import type { KomaTheme } from "@koma/ui/stores/theme-store";
import type { WorkspaceAutosaveSettings } from "../../utils/workspaceAutosaveSettings";
import type {
  DesktopMiniBackendRuntimeArtifactOption,
  DesktopMiniBackendRuntimeState,
  UpdaterChannel,
} from "../../types";
import type {
  LocalResetFeedbackState,
  WorkspaceAutosaveFeedbackState,
} from "./settings.types";

type TranslationFn = ReturnType<typeof useI18n>["t"];
type UpdaterStatusInfo = { labelKey: string; color: string; dot: string };

interface SettingsAppTabArgs {
  t: TranslationFn;
  currentTheme: KomaTheme;
  setCurrentTheme: (theme: KomaTheme) => void;
  locale: AppLocale;
  localeLabels: Record<AppLocale, string>;
  setLocale: (locale: AppLocale) => void;
  supportedLocales: readonly AppLocale[];
  systemLocales: AppLocale[];
  updater: UseUpdaterApi;
  statusInfo: UpdaterStatusInfo;
  channelLabel: string;
  fmtDate: (value: number | string | null) => string;
  busy: boolean;
  handleChannel: (channel: UpdaterChannel) => Promise<void>;
  handleAutoInstall: (enabled: boolean) => Promise<void>;
  workspaceAutosaveSettings: WorkspaceAutosaveSettings;
  setWorkspaceAutosaveSettings: Dispatch<SetStateAction<WorkspaceAutosaveSettings>>;
  setWorkspaceAutosaveFeedback: Dispatch<SetStateAction<WorkspaceAutosaveFeedbackState>>;
  workspaceAutosaveFeedback: WorkspaceAutosaveFeedbackState;
  handleSaveWorkspaceAutosaveSettings: () => void;
  toolTipsEnabled: boolean;
  setToolTipsEnabled: (enabled: boolean) => void;
  localResetBusy: boolean;
  handleResetLocalAppSettings: () => Promise<void>;
  localResetFeedback: LocalResetFeedbackState;
  handleCheck: () => Promise<void>;
  handleDownload: () => Promise<void>;
  handleInstall: () => Promise<void>;
  runtimeState: DesktopMiniBackendRuntimeState | null;
  recommendedRuntimeProfile: string;
  runtimeArtifactsAvailable: boolean;
  runtimeArtifactsAvailabilityLabel: string;
  runtimeInstallBusy: boolean;
  runtimeInstallInProgress: boolean;
  runtimeInstallMode: "manual" | null;
  runtimeInstallButtonLabel: string;
  runtimeInstallFeedback: string | null;
  runtimeInstallError: string | null;
  runtimeArtifactOptions: DesktopMiniBackendRuntimeArtifactOption[];
  selectedRuntimeArtifactProfile: string;
  setSelectedRuntimeArtifactProfile: Dispatch<SetStateAction<string>>;
  handleUseRecommendedRuntimeProfile: (profile: string) => void;
  handleInstallSelectedRuntimeProfile: () => Promise<void>;
  formatRuntimeProfileLabel: (profile: string) => string;
}

export const renderSettingsAppTab = ({
  t,
  currentTheme,
  setCurrentTheme,
  locale,
  localeLabels,
  setLocale,
  supportedLocales,
  systemLocales,
  updater,
  statusInfo,
  channelLabel,
  fmtDate,
  busy,
  handleChannel,
  handleAutoInstall,
  workspaceAutosaveSettings,
  setWorkspaceAutosaveSettings,
  setWorkspaceAutosaveFeedback,
  workspaceAutosaveFeedback,
  handleSaveWorkspaceAutosaveSettings,
  toolTipsEnabled,
  setToolTipsEnabled,
  localResetBusy,
  handleResetLocalAppSettings,
  localResetFeedback,
  handleCheck,
  handleDownload,
  handleInstall,
  runtimeState,
  recommendedRuntimeProfile,
  runtimeArtifactsAvailable,
  runtimeArtifactsAvailabilityLabel,
  runtimeInstallBusy,
  runtimeInstallInProgress,
  runtimeInstallMode,
  runtimeInstallButtonLabel,
  runtimeInstallFeedback,
  runtimeInstallError,
  runtimeArtifactOptions,
  selectedRuntimeArtifactProfile,
  setSelectedRuntimeArtifactProfile,
  handleUseRecommendedRuntimeProfile,
  handleInstallSelectedRuntimeProfile,
  formatRuntimeProfileLabel,
}: SettingsAppTabArgs): JSX.Element => (
<div className="koma-stg-panel" key="app">
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

  {/* Version Info */}
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.updates.title")}</h3>
    </div>

    <div className="koma-stg-grid">
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.updates.currentVersion")}</span>
        <span className="koma-stg-item__value koma-stg-item__value--mono">v{updater.currentVersion}</span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.updates.newVersion")}</span>
        <span className="koma-stg-item__value koma-stg-item__value--mono">
          {updater.newVersion ? `v${updater.newVersion}` : t("common.notAvailableShort")}
        </span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.updates.status")}</span>
        <span className="koma-stg-item__value" style={{ color: statusInfo.color }}>
          <span className="koma-stg-dot" style={{ background: statusInfo.dot }} />
          {t(statusInfo.labelKey)}
        </span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.updates.channel")}</span>
        <span className="koma-stg-item__value">{channelLabel}</span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.updates.installOnClose")}</span>
        <span className="koma-stg-item__value">{updater.autoInstallOnQuit ? t("renderPreview.enabled") : t("renderPreview.disabled")}</span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.updates.policy")}</span>
        <span className="koma-stg-item__value">{updater.mandatory ? t("settings.updates.mandatory") : t("settings.updates.optional")}</span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.updates.lastCheck")}</span>
        <span className="koma-stg-item__value">{fmtDate(updater.checkedAt)}</span>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.updates.downloadCompleted")}</span>
        <span className="koma-stg-item__value">{fmtDate(updater.downloadedAt)}</span>
      </div>
    </div>
  </section>

  {/* Channel Selector */}
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2H2V5zm0 4h16v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9z" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.updates.channelTitle")}</h3>
    </div>

    <div className="koma-stg-channels">
      <button
        type="button"
        disabled={busy}
        className={`koma-stg-channel ${updater.channel === "stable" ? "koma-stg-channel--active" : ""}`}
        onClick={() => void handleChannel("stable")}
      >
        <span className="koma-stg-channel__dot" />
        <div>
          <span className="koma-stg-channel__name">{t("update.channel.stable")}</span>
          <span className="koma-stg-channel__desc">{t("settings.updates.stableDesc")}</span>
        </div>
      </button>
      <button
        type="button"
        disabled={busy}
        className={`koma-stg-channel ${updater.channel === "beta" ? "koma-stg-channel--active koma-stg-channel--beta" : ""}`}
        onClick={() => void handleChannel("beta")}
      >
        <span className="koma-stg-channel__dot" />
        <div>
          <span className="koma-stg-channel__name">{t("update.channel.beta")}</span>
          <span className="koma-stg-channel__desc">{t("settings.updates.betaDesc")}</span>
        </div>
      </button>
    </div>
  </section>

  {/* Auto-install toggle */}
  <section className="koma-stg-section">
    <label className="koma-stg-toggle-wide">
      <div>
        <span className="koma-stg-toggle-wide__title">{t("settings.updates.installOnCloseTitle")}</span>
        <p className="koma-stg-toggle-wide__desc">
          {t("settings.updates.installOnCloseDesc")}
        </p>
      </div>
      <div className={`koma-toggle ${updater.autoInstallOnQuit ? "koma-toggle--on" : ""}`}>
        <input
          type="checkbox"
          className="koma-toggle__input"
          checked={updater.autoInstallOnQuit}
          disabled={busy}
          onChange={(e) => void handleAutoInstall(e.target.checked)}
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
        <path d="M10 2.75a1 1 0 011 1v.82a5.75 5.75 0 012.16.9l.58-.58a1 1 0 111.42 1.42l-.58.58a5.75 5.75 0 01.9 2.16H16.25a1 1 0 110 2h-.82a5.75 5.75 0 01-.9 2.16l.58.58a1 1 0 11-1.42 1.42l-.58-.58a5.75 5.75 0 01-2.16.9v.82a1 1 0 11-2 0v-.82a5.75 5.75 0 01-2.16-.9l-.58.58a1 1 0 11-1.42-1.42l.58-.58a5.75 5.75 0 01-.9-2.16H3.75a1 1 0 110-2h.82a5.75 5.75 0 01.9-2.16l-.58-.58a1 1 0 111.42-1.42l.58.58a5.75 5.75 0 012.16-.9v-.82a1 1 0 011-1zm0 4a3.25 3.25 0 100 6.5 3.25 3.25 0 000-6.5z" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.autosave.title")}</h3>
    </div>
    <p className="koma-stg-section__desc">
      {t("settings.autosave.description")}
    </p>

    <label className="koma-stg-toggle-wide">
      <div>
        <span className="koma-stg-toggle-wide__title">{t("settings.autosave.enableTitle")}</span>
        <p className="koma-stg-toggle-wide__desc">
          {t("settings.autosave.enableDesc")}
        </p>
      </div>
      <div className={`koma-toggle ${workspaceAutosaveSettings.enabled ? "koma-toggle--on" : ""}`}>
        <input
          type="checkbox"
          className="koma-toggle__input"
          checked={workspaceAutosaveSettings.enabled}
          onChange={(e) => {
            setWorkspaceAutosaveFeedback(null);
            setWorkspaceAutosaveSettings((prev) => ({
              ...prev,
              enabled: e.target.checked,
            }));
          }}
        />
        <span className="koma-toggle__track">
          <span className="koma-toggle__thumb" />
        </span>
      </div>
    </label>

    <div className="koma-stg-grid" style={{ marginTop: 16 }}>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.autosave.interval")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <input
            type="number"
            min={15}
            max={3600}
            step={15}
            className="koma-ig-field__input"
            value={workspaceAutosaveSettings.intervalSeconds}
            disabled={!workspaceAutosaveSettings.enabled}
            onChange={(e) => {
              setWorkspaceAutosaveFeedback(null);
              const nextValue = Math.min(3600, Math.max(15, Number(e.target.value) || 60));
              setWorkspaceAutosaveSettings((prev) => ({
                ...prev,
                intervalSeconds: nextValue,
              }));
            }}
            style={{ maxWidth: 140, height: 32 }}
          />
          <span className="koma-stg-item__value">
            {workspaceAutosaveSettings.intervalSeconds >= 60 && workspaceAutosaveSettings.intervalSeconds % 60 === 0
              ? `${workspaceAutosaveSettings.intervalSeconds / 60} min`
              : `${workspaceAutosaveSettings.intervalSeconds}s`}
          </span>
        </div>
      </div>
    </div>

    <div className="koma-stg-actions koma-stg-actions--row" style={{ marginTop: 18 }}>
      <button
        type="button"
        className="koma-btn koma-btn--primary koma-btn--sm"
        onClick={handleSaveWorkspaceAutosaveSettings}
      >
        {t("settings.autosave.save")}
      </button>
    </div>

    {workspaceAutosaveFeedback && (
      <div
        className={`koma-stg-alert ${workspaceAutosaveFeedback.type === "error" ? "koma-stg-alert--error" : "koma-stg-alert--success"}`}
        role={workspaceAutosaveFeedback.type === "error" ? "alert" : "status"}
      >
        {workspaceAutosaveFeedback.type === "error" ? (
          <AlertTriangle size={11} />
        ) : (
          <CheckCircle2 size={11} />
        )}
        <span>{workspaceAutosaveFeedback.message}</span>
      </div>
    )}
  </section>

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

  {/* Action buttons */}
  <div className="koma-stg-actions koma-stg-actions--row">
    <button type="button" disabled={busy} onClick={() => void handleCheck()} className="koma-btn koma-btn--primary koma-btn--sm">
      {busy ? (
        <><span className="auth-spinner" /> {t("settings.updates.checking")}</>
      ) : (
        t("settings.updates.checkNow")
      )}
    </button>
    {updater.status === "available" && (
      <button type="button" disabled={busy} onClick={() => void handleDownload()} className="koma-btn koma-btn--ghost koma-btn--sm">
        {t("settings.updates.download")}
      </button>
    )}
    {updater.status === "downloaded" && (
      <button type="button" disabled={busy} onClick={() => void handleInstall()} className="koma-btn koma-btn--success koma-btn--sm">
        {t("update.button.installNow")}
      </button>
    )}
  </div>

  {/* Release Notes */}
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
      <h3 className="koma-stg-section__title">{t("update.modal.releaseNotes")}</h3>
    </div>
    {updater.releaseNotes ? (
      <div className="koma-stg-release">
        <ReleaseNotesMarkdown markdown={updater.releaseNotes} className="koma-stg-release__md" />
      </div>
    ) : (
      <p className="koma-stg-empty-text">{t("update.modal.releaseNotesEmpty")}</p>
    )}
  </section>

  {updater.error && (
    <div className="koma-stg-alert koma-stg-alert--error" role="alert">
      <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
      <span>{updater.error}</span>
    </div>
  )}

  <RuntimeProfileSection
    runtimeState={runtimeState}
    recommendedProfile={recommendedRuntimeProfile}
    runtimeArtifactsAvailable={runtimeArtifactsAvailable}
    runtimeArtifactsAvailabilityLabel={runtimeArtifactsAvailabilityLabel}
    runtimeInstallBusy={runtimeInstallBusy}
    runtimeInstallInProgress={runtimeInstallInProgress}
    runtimeInstallMode={runtimeInstallMode}
    runtimeInstallButtonLabel={runtimeInstallButtonLabel}
    runtimeInstallFeedback={runtimeInstallFeedback}
    runtimeInstallError={runtimeInstallError}
    manualArtifacts={runtimeArtifactOptions}
    selectedManualProfile={selectedRuntimeArtifactProfile}
    onSelectedManualProfileChange={setSelectedRuntimeArtifactProfile}
    onUseRecommendedProfile={handleUseRecommendedRuntimeProfile}
    onInstallSelected={() => void handleInstallSelectedRuntimeProfile()}
    formatRuntimeProfileLabel={formatRuntimeProfileLabel}
  />
</div>
);
