import type { Dispatch, JSX, SetStateAction } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type { useI18n } from "../../i18n";
import type {
  MiniBackendTunablesSaveStatus,
  MiniBackendTunablesSettings,
} from "./hooks/use-mini-backend-thread-settings";

type TranslationFn = ReturnType<typeof useI18n>["t"];

interface SettingsSidecarTunablesSectionProps {
  t: TranslationFn;
  miniBackendTunables: MiniBackendTunablesSettings;
  setMiniBackendTunables: Dispatch<SetStateAction<MiniBackendTunablesSettings>>;
  miniBackendTunablesSaveStatus: MiniBackendTunablesSaveStatus;
  handleSaveMiniBackendTunables: () => void;
}

export const SettingsSidecarTunablesSection = ({
  t,
  miniBackendTunables,
  setMiniBackendTunables,
  miniBackendTunablesSaveStatus,
  handleSaveMiniBackendTunables,
}: SettingsSidecarTunablesSectionProps): JSX.Element => (
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
);
