import type { JSX } from "react";
import type { Dispatch, SetStateAction } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type { useI18n } from "../../i18n";
import type { WorkspaceAutosaveSettings } from "../../utils/workspaceAutosaveSettings";
import type { MiniBackendThreadSettings } from "../../utils/miniBackendThreadSettings";
import type {
  MiniBackendTunablesSaveStatus,
  MiniBackendTunablesSettings,
} from "./hooks/use-mini-backend-thread-settings";
import type {
  WorkspaceAutosaveFeedbackState,
} from "./settings.types";
import { SettingsCacheSection } from "./SettingsCacheSection";

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
  miniBackendTunablesSaveStatus: MiniBackendTunablesSaveStatus;
  handleSaveMiniBackendTunables: () => void;
}

export const renderSettingsPerformanceTab = ({
  t,
  workspaceAutosaveSettings,
  setWorkspaceAutosaveSettings,
  setWorkspaceAutosaveFeedback,
  workspaceAutosaveFeedback,
  handleSaveWorkspaceAutosaveSettings,
  miniBackendThreadSettings,
  setMiniBackendIntraOpThreads,
  miniBackendHardwareConcurrency,
  miniBackendTunables,
  setMiniBackendTunables,
  miniBackendTunablesSaveStatus,
  handleSaveMiniBackendTunables,
}: SettingsPerformanceTabArgs): JSX.Element => (
<div className="koma-stg-panel" key="performance">

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

  {/* Performance */}
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path d="M11 1L3 12h6l-1 7 8-11h-6l1-7z" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.app.performance.title")}</h3>
    </div>
    <p className="koma-stg-section__desc">
      {t("settings.app.performance.desc")}
    </p>

    <div className="koma-stg-grid">
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.app.performance.threads.label")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <input
            type="number"
            min={1}
            max={64}
            step={1}
            className="koma-ig-field__input"
            placeholder={t("settings.app.performance.threads.placeholder")}
            value={miniBackendThreadSettings.intraOpThreads ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (!raw) {
                setMiniBackendIntraOpThreads(null);
                return;
              }
              const parsed = Number(raw);
              if (Number.isFinite(parsed) && parsed >= 1) {
                setMiniBackendIntraOpThreads(Math.min(64, Math.round(parsed)));
              }
            }}
            style={{ maxWidth: 140, height: 32 }}
          />
          <span className="koma-stg-item__value">
            {miniBackendThreadSettings.intraOpThreads === null
              ? t("settings.app.performance.threads.default")
              : `${miniBackendThreadSettings.intraOpThreads}`}
          </span>
          <button
            type="button"
            className="koma-btn koma-btn--ghost koma-btn--sm"
            disabled={
              miniBackendHardwareConcurrency === null ||
              miniBackendHardwareConcurrency <= 2
            }
            onClick={() => {
              if (miniBackendHardwareConcurrency !== null) {
                setMiniBackendIntraOpThreads(
                  Math.max(1, miniBackendHardwareConcurrency - 2),
                );
              }
            }}
          >
            {t("settings.app.performance.threads.reserveCores")}
          </button>
        </div>
        <p className="koma-stg-section__desc" style={{ marginTop: 12 }}>
          {t("settings.app.performance.threads.restartHint")}
        </p>
      </div>
    </div>
  </section>

  {/* Sidecar Tunables */}
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path d="M10 2.75a7.25 7.25 0 100 14.5 7.25 7.25 0 000-14.5zm0 1.5a5.75 5.75 0 110 11.5 5.75 5.75 0 010-11.5zM9.25 5.75h1.5v4.44l2.66 2.66-1.06 1.06-3.1-3.1V5.75z" />
      </svg>
      <h3 className="koma-stg-section__title">{t("settings.app.performance.tunables.title")}</h3>
    </div>
    <p className="koma-stg-section__desc">
      {t("settings.app.performance.tunables.desc")}
    </p>

    <div className="koma-stg-grid">
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.app.performance.tunables.idleTimeoutLabel")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <input
            type="number"
            min={0}
            max={86400}
            step={60}
            className="koma-ig-field__input"
            value={miniBackendTunables.engineIdleTimeoutSeconds}
            onChange={(e) => {
              const parsed = Math.round(Number(e.target.value));
              setMiniBackendTunables((prev) => ({
                ...prev,
                engineIdleTimeoutSeconds: Number.isFinite(parsed)
                  ? Math.min(86400, Math.max(0, parsed))
                  : prev.engineIdleTimeoutSeconds,
              }));
            }}
            style={{ maxWidth: 140, height: 32 }}
          />
          <span className="koma-stg-item__value">
            {miniBackendTunables.engineIdleTimeoutSeconds === 0
              ? t("settings.app.performance.tunables.idleTimeoutOff")
              : miniBackendTunables.engineIdleTimeoutSeconds >= 60 &&
                  miniBackendTunables.engineIdleTimeoutSeconds % 60 === 0
                ? `${miniBackendTunables.engineIdleTimeoutSeconds / 60} min`
                : `${miniBackendTunables.engineIdleTimeoutSeconds}s`}
          </span>
        </div>
      </div>
      <div className="koma-stg-item">
        <span className="koma-stg-item__label">{t("settings.app.performance.tunables.resolutionLabel")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <select
            className="koma-ig-field__select"
            value={miniBackendTunables.workingResolutionMegapixels}
            onChange={(e) => {
              setMiniBackendTunables((prev) => ({
                ...prev,
                workingResolutionMegapixels: Number(e.target.value),
              }));
            }}
            style={{ maxWidth: 140, height: 32 }}
          >
            {[8, 12, 16, 24, 32, 48].map((megapixels) => (
              <option key={megapixels} value={megapixels}>{megapixels}</option>
            ))}
          </select>
        </div>
        <p className="koma-stg-section__desc" style={{ marginTop: 8 }}>
          {t("settings.app.performance.tunables.resolutionDesc")}
        </p>
      </div>
    </div>

    <label className="koma-stg-toggle-wide" style={{ marginTop: 16 }}>
      <div>
        <span className="koma-stg-toggle-wide__title">{t("settings.app.performance.tunables.ocrCleanLabel")}</span>
        <p className="koma-stg-toggle-wide__desc">
          {t("settings.app.performance.tunables.ocrCleanDesc")}
        </p>
      </div>
      <div className={`koma-toggle ${miniBackendTunables.workingResolutionOcrClean ? "koma-toggle--on" : ""}`}>
        <input
          type="checkbox"
          className="koma-toggle__input"
          checked={miniBackendTunables.workingResolutionOcrClean}
          onChange={(e) => {
            setMiniBackendTunables((prev) => ({
              ...prev,
              workingResolutionOcrClean: e.target.checked,
            }));
          }}
        />
        <span className="koma-toggle__track">
          <span className="koma-toggle__thumb" />
        </span>
      </div>
    </label>

    <div className="koma-stg-actions koma-stg-actions--row" style={{ marginTop: 18 }}>
      <button
        type="button"
        className="koma-btn koma-btn--primary koma-btn--sm"
        onClick={handleSaveMiniBackendTunables}
      >
        {t("settings.app.performance.tunables.save")}
      </button>
    </div>

    {(miniBackendTunablesSaveStatus === "saved" || miniBackendTunablesSaveStatus === "failed") && (
      <div
        className={`koma-stg-alert ${miniBackendTunablesSaveStatus === "failed" ? "koma-stg-alert--error" : "koma-stg-alert--success"}`}
        role={miniBackendTunablesSaveStatus === "failed" ? "alert" : "status"}
      >
        {miniBackendTunablesSaveStatus === "failed" ? (
          <AlertTriangle size={11} />
        ) : (
          <CheckCircle2 size={11} />
        )}
        <span>
          {miniBackendTunablesSaveStatus === "failed"
            ? t("settings.app.performance.tunables.failed")
            : t("settings.app.performance.tunables.saved")}
        </span>
      </div>
    )}

    <p className="koma-stg-section__desc" style={{ marginTop: 12 }}>
      {t("settings.app.performance.tunables.restartHint")}
    </p>
  </section>

  {/* Tool Tips */}
  <SettingsCacheSection t={t} />

</div>
);
