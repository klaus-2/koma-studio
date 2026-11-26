import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { DownloadCloud, Radio, FileText } from "lucide-react";
import RuntimeProfileSection from "../../../components/runtime/RuntimeProfileSection";
import ReleaseNotesMarkdown from "../../../components/updater/ReleaseNotesMarkdown";
import SyncPanel from "../../../components/updater/SyncPanel";
import type { useI18n } from "../../../i18n";
import { isSourceSyncVisible } from "../../../hooks/useUpdaterSync";
import type { UseUpdaterApi } from "../../../hooks/useUpdater";
import type {
  DesktopMiniBackendRuntimeArtifactOption, DesktopMiniBackendRuntimeState, UpdaterChannel,
} from "../../../types";
import {
  Sec, SpecGrid, SpecRow, Alert,
  btnPrimary, btnGhost,
} from "./primitives";

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
  handleCancelRuntimeInstall?: () => Promise<void>;
  formatRuntimeProfileLabel: (profile: string) => string;
}

export const renderSettingsRuntimeTabNoir = (a: SettingsRuntimeTabArgs): React.ReactElement => {
  const { t, updater } = a;

  return (
    <div className="space-y-5" key="runtime">

      {/* ═══ UPDATES dossier ═══ */}
      <Sec icon={<DownloadCloud size={14} />} title={t("settings.updates.title")}
        actions={
          <div className="flex gap-2">
            <button type="button" disabled={a.busy || !updater.currentVersion} onClick={() => void a.handleCheck()} className={btnPrimary}>
              {a.busy ? <span className="blink">{t("settings.updates.checking")}</span> : t("settings.updates.checkNow")}
            </button>
            {updater.status === "available" && (
              <button
                type="button"
                disabled={a.busy}
                onClick={() => void updater.downloadUpdate()}
                className={btnGhost}
              >
                {updater.autoInstallSupported
                  ? t("update.modal.updateNow")
                  : t("update.modal.openReleasePage")}
              </button>
            )}
            {updater.status === "downloaded" && (
              <button
                type="button"
                disabled={a.busy}
                onClick={() => void updater.installUpdate()}
                className={btnPrimary}
              >
                {t("update.modal.restartToUpdate")}
              </button>
            )}
          </div>
        }>
        <SpecGrid>
          <SpecRow label={t("settings.updates.currentVersion")} mono>
            {updater.currentVersion ? `v${updater.currentVersion}` : t("common.notAvailableShort")}
          </SpecRow>
          <SpecRow label={t("settings.updates.newVersion")} mono>
            {updater.newVersion ? <span className="text-gold">v{updater.newVersion}</span> : t("common.notAvailableShort")}
          </SpecRow>
          <SpecRow label={t("settings.updates.status")}>
            <span className="inline-flex items-center gap-1.5" style={{ color: a.statusInfo.color }}>
              <span aria-hidden className="blink h-1.5 w-1.5" style={{ background: a.statusInfo.dot }} />
              {t(a.statusInfo.labelKey)}
            </span>
          </SpecRow>
          <SpecRow label={t("settings.updates.channel")}>{a.channelLabel}</SpecRow>
          <SpecRow label={t("settings.updates.lastCheck")} mono>{a.fmtDate(updater.checkedAt)}</SpecRow>
        </SpecGrid>
        {updater.status === "error" && updater.error && (
          <div className="mt-3"><Alert tone="error">{updater.error}</Alert></div>
        )}

        {isSourceSyncVisible() && (
          <div className="mt-4">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.24em] text-paper/40">{t("update.sync.title")}</p>
            <SyncPanel />
          </div>
        )}
      </Sec>

      {/* ═══ CHANNEL ═══ */}
      <Sec icon={<Radio size={14} />} title={t("settings.updates.channelTitle")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { ch: "stable" as UpdaterChannel, name: t("update.channel.stable"), desc: t("settings.updates.stableDesc"), tone: "mint" as const },
            { ch: "beta" as UpdaterChannel, name: t("update.channel.beta"), desc: t("settings.updates.betaDesc"), tone: "gold" as const },
          ]).map(({ ch, name, desc, tone }) => {
            const active = updater.channel === ch;
            return (
              <button key={ch} type="button" disabled={a.busy || (ch === "beta" && a.betaChannelDisabled)} onClick={() => void a.handleChannel(ch)}
                aria-pressed={active}
                className={`panel-cut-sm hard-hover flex items-start gap-3 border p-4 text-left transition-colors disabled:opacity-40 ${active
                  ? tone === "gold" ? "border-gold/60 bg-gold/8" : "border-mint/60 bg-mint/8"
                  : "border-paper/12 bg-ink/50"
                  }`}>
                <span aria-hidden className={`mt-1 h-2 w-2 ${active ? (tone === "gold" ? "blink bg-gold" : "bg-mint") : "bg-paper/20"}`} />
                <span>
                  <span className="block font-display text-xs font-black uppercase tracking-tight text-paper">{name}</span>
                  <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-wider text-paper/40">{desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        {a.betaChannelDisabled && (
          <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-paper/40">
            {t("settings.updates.betaManualOnly")}
          </p>
        )}
      </Sec>

      {/* ═══ RELEASE NOTES ═══ */}
      <Sec icon={<FileText size={14} />} title={t("update.modal.releaseNotes")}>
        {updater.releaseNotes ? (
          <div className="panel-cut-sm max-h-64 overflow-y-auto border border-paper/8 bg-ink/60 p-4">
            <ReleaseNotesMarkdown markdown={updater.releaseNotes} className="prose prose-invert prose-sm max-w-none" />
          </div>
        ) : (
          <p className="font-mono text-[11px] uppercase tracking-wider text-paper/30">{t("update.modal.releaseNotesEmpty")}</p>
        )}
      </Sec>

      {updater.error && <Alert tone="error">{updater.error}</Alert>}

      {/* Runtime — componente existente preservado */}
      <RuntimeProfileSection
        runtimeState={a.runtimeState}
        recommendedProfile={a.recommendedRuntimeProfile}
        runtimeArtifactsAvailable={a.runtimeArtifactsAvailable}
        runtimeArtifactsAvailabilityLabel={a.runtimeArtifactsAvailabilityLabel}
        runtimeInstallBusy={a.runtimeInstallBusy}
        runtimeInstallInProgress={a.runtimeInstallInProgress}
        runtimeInstallMode={a.runtimeInstallMode}
        runtimeInstallButtonLabel={a.runtimeInstallButtonLabel}
        runtimeInstallFeedback={a.runtimeInstallFeedback}
        runtimeInstallError={a.runtimeInstallError}
        manualArtifacts={a.runtimeArtifactOptions}
        selectedManualProfile={a.selectedRuntimeArtifactProfile}
        onSelectedManualProfileChange={a.setSelectedRuntimeArtifactProfile}
        onUseRecommendedProfile={a.handleUseRecommendedRuntimeProfile}
        onInstallSelected={() => void a.handleInstallSelectedRuntimeProfile()}
        onCancelInstall={a.handleCancelRuntimeInstall ? () => { void a.handleCancelRuntimeInstall?.(); } : undefined}
        formatRuntimeProfileLabel={a.formatRuntimeProfileLabel}
      />
    </div>
  );
};
