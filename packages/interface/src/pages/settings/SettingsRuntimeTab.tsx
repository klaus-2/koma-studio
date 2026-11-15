import type { JSX } from "react";
import type { Dispatch, SetStateAction } from "react";

import RuntimeProfileSection from "../../components/runtime/RuntimeProfileSection";
import ReleaseNotesMarkdownClassic from "../../components/updater/ReleaseNotesMarkdownClassic";
import { SyncPanel } from "../../components/updater/SyncPanel";
import type { useI18n } from "../../i18n";
import type { UseUpdaterApi } from "../../hooks/useUpdater";
import type {
  DesktopMiniBackendRuntimeArtifactOption,
  DesktopMiniBackendRuntimeState,
  UpdaterChannel,
} from "../../types";

type TranslationFn = ReturnType<typeof useI18n>["t"];
type UpdaterStatusInfo = { labelKey: string; color: string; dot: string };

interface SettingsRuntimeTabArgs {
  t: TranslationFn;
  updater: UseUpdaterApi;
  statusInfo: UpdaterStatusInfo;
  channelLabel: string;
  betaChannelDisabled: boolean;
  fmtDate: (value: number | string | null) => string;
  busy: boolean;
  handleChannel: (channel: UpdaterChannel) => Promise<void>;
  handleCheck: () => Promise<void>;
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

export const renderSettingsRuntimeTab = ({
  t,
  updater,
  statusInfo,
  channelLabel,
  betaChannelDisabled,
  fmtDate,
  busy,
  handleChannel,
  handleCheck,
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
}: SettingsRuntimeTabArgs): JSX.Element => (
<div className="koma-stg-panel" key="runtime">

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
        <span className="koma-stg-item__value koma-stg-item__value--mono">
          {updater.currentVersion ? `v${updater.currentVersion}` : t("common.notAvailableShort")}
        </span>
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
        <span className="koma-stg-item__label">{t("settings.updates.lastCheck")}</span>
        <span className="koma-stg-item__value">{fmtDate(updater.checkedAt)}</span>
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
        disabled={busy || betaChannelDisabled}
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
    {betaChannelDisabled && (
      <p className="koma-stg-section__desc" style={{ marginTop: 12 }}>
        {t("settings.updates.betaManualOnly")}
      </p>
    )}
  </section>

  {/* Source-sync control panel */}
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h3 className="koma-stg-section__title">{t("update.sync.title")}</h3>
    </div>
    <SyncPanel />
  </section>

  {/* Action buttons */}
  <div className="koma-stg-actions koma-stg-actions--row">
    <button type="button" disabled={busy || !updater.currentVersion} onClick={() => void handleCheck()} className="koma-btn koma-btn--primary koma-btn--sm">
      {busy ? (
        <><span className="auth-spinner" /> {t("settings.updates.checking")}</>
      ) : (
        t("settings.updates.checkNow")
      )}
    </button>
    {updater.status === "available" && (
      <button
        type="button"
        disabled={busy}
        onClick={() => void updater.downloadUpdate()}
        className="koma-btn koma-btn--ghost koma-btn--sm"
      >
        {updater.autoInstallSupported
          ? t("update.modal.updateNow")
          : t("update.modal.openReleasePage")}
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
        <ReleaseNotesMarkdownClassic markdown={updater.releaseNotes} className="koma-stg-release__md" />
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
