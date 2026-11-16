import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { Save, Timer, Zap } from "lucide-react";
import type { useI18n } from "../../../i18n";
import type { WorkspaceAutosaveSettings } from "../../../utils/workspaceAutosaveSettings";
import type { MiniBackendThreadSettings } from "../../../utils/miniBackendThreadSettings";
import type { MiniBackendTunablesSettings } from "../hooks/use-mini-backend-thread-settings";
import type { WorkspaceAutosaveFeedbackState } from "../settings.types";
import { SettingsCacheSectionNoir } from "./SettingsCacheSectionNoir";
import {
  Sec, Field, Alert, ToggleRow,
  inputCls, selectCls, btnPrimary, btnGhost,
} from "./primitives";

type TranslationFn = ReturnType<typeof useI18n>["t"];

interface SettingsPerformanceTabArgs {
  t: TranslationFn;
  workspaceAutosaveSettings: WorkspaceAutosaveSettings;
  setWorkspaceAutosaveSettings: Dispatch<SetStateAction<WorkspaceAutosaveSettings>>;
  setWorkspaceAutosaveFeedback: Dispatch<SetStateAction<WorkspaceAutosaveFeedbackState>>;
  workspaceAutosaveFeedback: WorkspaceAutosaveFeedbackState;
  handleSaveWorkspaceAutosaveSettings: () => void;
  miniBackendThreadSettings: MiniBackendThreadSettings;
  setMiniBackendIntraOpThreads: (value: number | null) => void;
  miniBackendHardwareConcurrency: number | null;
  miniBackendTunables: MiniBackendTunablesSettings;
  setMiniBackendTunables: Dispatch<SetStateAction<MiniBackendTunablesSettings>>;
  handleSaveMiniBackendTunables: () => void;
}

export const renderSettingsPerformanceTabNoir = (a: SettingsPerformanceTabArgs): React.ReactElement => {
  const { t } = a;

  return (
    <div className="space-y-5" key="performance">

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

      {/* ═══ PERFORMANCE ═══ */}
      <Sec icon={<Zap size={14} />} title={t("settings.app.performance.title")} desc={t("settings.app.performance.desc")}>
        <div className="flex flex-wrap items-end gap-4">
          <Field label={t("settings.app.performance.threads.label")} className="w-40">
            <input type="number" min={1} max={64} step={1} className={inputCls}
              placeholder={t("settings.app.performance.threads.placeholder")}
              value={a.miniBackendThreadSettings.intraOpThreads ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (!raw) {
                  a.setMiniBackendIntraOpThreads(null);
                  return;
                }
                const parsed = Number(raw);
                if (Number.isFinite(parsed) && parsed >= 1) {
                  a.setMiniBackendIntraOpThreads(Math.min(64, Math.round(parsed)));
                }
              }} />
          </Field>
          <span className="pb-2 font-mono text-[11px] font-bold text-gold">
            {a.miniBackendThreadSettings.intraOpThreads === null
              ? t("settings.app.performance.threads.default")
              : String(a.miniBackendThreadSettings.intraOpThreads)}
          </span>
          <button type="button" className={btnGhost}
            disabled={a.miniBackendHardwareConcurrency === null || a.miniBackendHardwareConcurrency <= 2}
            onClick={() => {
              if (a.miniBackendHardwareConcurrency !== null) {
                a.setMiniBackendIntraOpThreads(Math.max(1, a.miniBackendHardwareConcurrency - 2));
              }
            }}>
            {t("settings.app.performance.threads.reserveCores")}
          </button>
        </div>
        <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-paper/40">
          {t("settings.app.performance.threads.restartHint")}
        </p>
      </Sec>

      {/* ═══ SIDECAR TUNABLES ═══ */}
      <Sec icon={<Timer size={14} />} title={t("settings.app.performance.tunables.title")} desc={t("settings.app.performance.tunables.desc")}>
        <div className="flex flex-wrap items-end gap-4">
          <Field label={t("settings.app.performance.tunables.idleTimeoutLabel")} className="w-40">
            <input type="number" min={0} max={86400} step={60} className={inputCls}
              value={a.miniBackendTunables.engineIdleTimeoutSeconds}
              onChange={(e) => {
                const parsed = Math.round(Number(e.target.value));
                a.setMiniBackendTunables((prev) => ({
                  ...prev,
                  engineIdleTimeoutSeconds: Number.isFinite(parsed)
                    ? Math.min(86400, Math.max(0, parsed))
                    : prev.engineIdleTimeoutSeconds,
                }));
              }} />
          </Field>
          <span className="pb-2 font-mono text-[11px] font-bold text-gold">
            {a.miniBackendTunables.engineIdleTimeoutSeconds === 0
              ? t("settings.app.performance.tunables.idleTimeoutOff")
              : a.miniBackendTunables.engineIdleTimeoutSeconds >= 60 &&
                  a.miniBackendTunables.engineIdleTimeoutSeconds % 60 === 0
                ? `${a.miniBackendTunables.engineIdleTimeoutSeconds / 60} min`
                : `${a.miniBackendTunables.engineIdleTimeoutSeconds}s`}
          </span>
          <Field label={t("settings.app.performance.tunables.resolutionLabel")} className="w-40">
            <select className={selectCls}
              value={a.miniBackendTunables.workingResolutionMegapixels}
              onChange={(e) => {
                a.setMiniBackendTunables((prev) => ({
                  ...prev,
                  workingResolutionMegapixels: Number(e.target.value),
                }));
              }}>
              {[8, 12, 16, 24, 32, 48].map((megapixels) => (
                <option key={megapixels} value={megapixels}>{megapixels}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <ToggleRow
            title={t("settings.app.performance.tunables.ocrCleanLabel")}
            desc={t("settings.app.performance.tunables.ocrCleanDesc")}
            checked={a.miniBackendTunables.workingResolutionOcrClean}
            onChange={(v) => {
              a.setMiniBackendTunables((prev) => ({
                ...prev,
                workingResolutionOcrClean: v,
              }));
            }} />
        </div>

        <div className="mt-4">
          <button type="button" className={btnPrimary} onClick={a.handleSaveMiniBackendTunables}>
            {t("settings.app.performance.tunables.save")}
          </button>
        </div>
        <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-paper/40">
          {t("settings.app.performance.tunables.restartHint")}
        </p>
      </Sec>

      <SettingsCacheSectionNoir t={t} />

    </div>
  );
};
