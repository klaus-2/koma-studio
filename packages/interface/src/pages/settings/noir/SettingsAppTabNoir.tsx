import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { Moon, Sun, Globe2, DownloadCloud, Radio, Save, Lightbulb, Keyboard, RotateCcw, FileText } from "lucide-react";
import RuntimeProfileSection from "../../../components/runtime/RuntimeProfileSection";
import ReleaseNotesMarkdownClassic from "../../../components/updater/ReleaseNotesMarkdownClassic";
import type { AppLocale } from "../../../i18n/config";
import type { useI18n } from "../../../i18n";
import type { UseUpdaterApi } from "../../../hooks/useUpdater";
import type { KomaTheme } from "@koma/ui/stores/theme-store";
import type { WorkspaceAutosaveSettings } from "../../../utils/workspaceAutosaveSettings";
import type {
  DesktopMiniBackendRuntimeArtifactOption, DesktopMiniBackendRuntimeState, UpdaterChannel,
} from "../../../types";
import type { LocalResetFeedbackState, WorkspaceAutosaveFeedbackState } from "../settings.types";
import {
  Sec, Field, SpecGrid, SpecRow, Alert, ToggleRow,
  inputCls, selectCls, btnPrimary, btnGhost, btnDanger,
} from "./primitives";

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

export const renderSettingsAppTabNoir = (a: SettingsAppTabArgs): React.ReactElement => {
  const { t, updater } = a;

  return (
    <div className="space-y-5" key="app">
      {/* ═══ THEME ═══ */}
      <Sec icon={<Moon size={14} />} title={t("settings.theme.title")} desc={t("settings.theme.description")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { id: "dark" as KomaTheme, Icon: Moon, nameKey: "settings.theme.dark", descKey: "settings.theme.darkDesc", jp: "闇" },
            { id: "light" as KomaTheme, Icon: Sun, nameKey: "settings.theme.light", descKey: "settings.theme.lightDesc", jp: "光" },
          ] as const).map((opt) => {
            const active = a.currentTheme === opt.id;
            return (
              <button key={opt.id} type="button" onClick={() => a.setCurrentTheme(opt.id)}
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

      {/* ═══ LANGUAGE ═══ */}
      <Sec icon={<Globe2 size={14} />} title={t("settings.language.title")} desc={t("settings.language.description")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("settings.language.label")}>
            <select className={selectCls} value={a.locale} onChange={(e) => a.setLocale(e.target.value as typeof a.locale)}>
              {a.supportedLocales.map((entry) => <option key={entry} value={entry}>{a.localeLabels[entry]}</option>)}
            </select>
          </Field>
          <Field label={t("settings.language.systemLabel")}>
            <p className="py-2 font-mono text-[11px] text-paper/60">
              {a.systemLocales.length > 0
                ? a.systemLocales.map((entry) => a.localeLabels[entry]).join(", ")
                : a.localeLabels[a.locale]}
            </p>
          </Field>
        </div>
        <p className="mt-3 font-mono text-[9px] uppercase tracking-wider text-paper/30">{t("settings.language.applied")}</p>
      </Sec>

      {/* ═══ UPDATES dossier ═══ */}
      <Sec icon={<DownloadCloud size={14} />} title={t("settings.updates.title")}
        actions={
          <div className="flex gap-2">
            <button type="button" disabled={a.busy} onClick={() => void a.handleCheck()} className={btnPrimary}>
              {a.busy ? <span className="blink">{t("settings.updates.checking")}</span> : t("settings.updates.checkNow")}
            </button>
            {updater.status === "available" && (
              <button type="button" disabled={a.busy} onClick={() => void a.handleDownload()} className={btnGhost}>
                {t("settings.updates.download")}
              </button>
            )}
            {updater.status === "downloaded" && (
              <button type="button" disabled={a.busy} onClick={() => void a.handleInstall()}
                className={`${btnPrimary} !bg-mint`}>
                {t("update.button.installNow")}
              </button>
            )}
          </div>
        }>
        <SpecGrid>
          <SpecRow label={t("settings.updates.currentVersion")} mono>v{updater.currentVersion}</SpecRow>
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
          <SpecRow label={t("settings.updates.installOnClose")}>
            {updater.autoInstallOnQuit ? t("renderPreview.enabled") : t("renderPreview.disabled")}
          </SpecRow>
          <SpecRow label={t("settings.updates.policy")}>
            {updater.mandatory ? t("settings.updates.mandatory") : t("settings.updates.optional")}
          </SpecRow>
          <SpecRow label={t("settings.updates.lastCheck")} mono>{a.fmtDate(updater.checkedAt)}</SpecRow>
          <SpecRow label={t("settings.updates.downloadCompleted")} mono>{a.fmtDate(updater.downloadedAt)}</SpecRow>
        </SpecGrid>
        {updater.status === "error" && updater.error && (
          <div className="mt-3"><Alert tone="error">{updater.error}</Alert></div>
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
              <button key={ch} type="button" disabled={a.busy} onClick={() => void a.handleChannel(ch)}
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

        <div className="mt-3">
          <ToggleRow
            title={t("settings.updates.installOnCloseTitle")}
            desc={t("settings.updates.installOnCloseDesc")}
            checked={updater.autoInstallOnQuit}
            disabled={a.busy}
            onChange={(v) => void a.handleAutoInstall(v)} />
        </div>
      </Sec>

      {/* ═══ AUTOSAVE ═══ */}
      <Sec icon={<Save size={14} />} title={t("settings.autosave.title")} desc={t("settings.autosave.description")}>
        <ToggleRow
          title={t("settings.autosave.enableTitle")}
          desc={t("settings.autosave.enableDesc")}
          checked={a.workspaceAutosaveSettings.enabled}
          onChange={(v) => {
            a.setWorkspaceAutosaveFeedback(null);
            a.setWorkspaceAutosaveSettings((prev) => ({ ...prev, enabled: v }));
          }} />

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label={t("settings.autosave.interval")} className="w-40">
            <input type="number" min={15} max={3600} step={15} className={inputCls}
              value={a.workspaceAutosaveSettings.intervalSeconds}
              disabled={!a.workspaceAutosaveSettings.enabled}
              onChange={(e) => {
                a.setWorkspaceAutosaveFeedback(null);
                const nextValue = Math.min(3600, Math.max(15, Number(e.target.value) || 60));
                a.setWorkspaceAutosaveSettings((prev) => ({ ...prev, intervalSeconds: nextValue }));
              }} />
          </Field>
          <span className="pb-2 font-mono text-[11px] font-bold text-gold">
            {a.workspaceAutosaveSettings.intervalSeconds >= 60 && a.workspaceAutosaveSettings.intervalSeconds % 60 === 0
              ? `${a.workspaceAutosaveSettings.intervalSeconds / 60} min`
              : `${a.workspaceAutosaveSettings.intervalSeconds}s`}
          </span>
          <button type="button" className={btnPrimary} onClick={a.handleSaveWorkspaceAutosaveSettings}>
            {t("settings.autosave.save")}
          </button>
        </div>

        {a.workspaceAutosaveFeedback && (
          <div className="mt-3">
            <Alert tone={a.workspaceAutosaveFeedback.type === "error" ? "error" : "success"}>
              {a.workspaceAutosaveFeedback.message}
            </Alert>
          </div>
        )}
      </Sec>

      {/* ═══ TOOLTIPS ═══ */}
      <Sec icon={<Lightbulb size={14} />} title={t("settings.tooltips.title")} desc={t("settings.tooltips.description")}>
        <ToggleRow
          title={t("settings.tooltips.enableTitle")}
          desc={t("settings.tooltips.enableDesc")}
          checked={a.toolTipsEnabled}
          onChange={a.setToolTipsEnabled} />
      </Sec>

      {/* ═══ SHORTCUTS ═══ */}
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

      {/* ═══ DANGER ZONE ═══ */}
      <Sec icon={<RotateCcw size={14} />} title={t("settings.app.reset.title")} desc={t("settings.app.reset.desc")}
        className="!border-crimson/20 halftone-red">
        <button type="button" className={btnDanger} disabled={a.localResetBusy}
          onClick={() => void a.handleResetLocalAppSettings()}>
          {a.localResetBusy
            ? <span className="blink">{t("common.loading")}</span>
            : <><RotateCcw size={11} /> {t("settings.app.reset.button")}</>}
        </button>
        {a.localResetFeedback && (
          <div className="mt-3">
            <Alert tone={a.localResetFeedback.type === "error" ? "error" : "success"}>
              {a.localResetFeedback.message}
            </Alert>
          </div>
        )}
      </Sec>

      {/* ═══ RELEASE NOTES ═══ */}
      <Sec icon={<FileText size={14} />} title={t("update.modal.releaseNotes")}>
        {updater.releaseNotes ? (
          <div className="panel-cut-sm max-h-64 overflow-y-auto border border-paper/8 bg-ink/60 p-4">
            <ReleaseNotesMarkdownClassic markdown={updater.releaseNotes} className="prose prose-invert prose-sm max-w-none" />
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
        formatRuntimeProfileLabel={a.formatRuntimeProfileLabel}
      />
    </div>
  );
};
