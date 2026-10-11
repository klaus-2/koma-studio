import { useEffect, useRef } from "react";
import { useUpdaterSync } from "../../hooks/useUpdaterSync";
import { useI18n } from "../../i18n";

const STEP_KEYS = [
  { id: "pull", labelKey: "update.sync.stepPull" },
  { id: "install", labelKey: "update.sync.stepInstall" },
  { id: "venv", labelKey: "update.sync.stepVenv" },
  { id: "build", labelKey: "update.sync.stepBuild" },
] as const;

const PHASE_LABEL_KEYS: Record<string, string> = {
  idle: "update.sync.phase.idle",
  precheck: "update.sync.phase.precheck",
  running: "update.sync.phase.running",
  "awaiting-rebuild": "update.sync.phase.awaitingRebuild",
  rebuilding: "update.sync.phase.rebuilding",
  completed: "update.sync.phase.completed",
  failed: "update.sync.phase.failed",
};

export const SyncPanelClassic = () => {
  const { t } = useI18n();
  const sync = useUpdaterSync();
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const box = logBoxRef.current;
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
  }, [sync.state.logLines.length]);

  const { state } = sync;
  const visibleSteps = STEP_KEYS.filter(
    (entry) => entry.id !== "build" || state.phase === "rebuilding" || state.phase === "completed",
  );

  return (
    <div className="koma-sync" role="region" aria-label={t("update.sync.title")}>
      <p className="koma-sync__phase" aria-live="polite">
        {t(PHASE_LABEL_KEYS[state.phase] ?? "update.sync.phase.idle")}
      </p>

      <div className="koma-sync__steps">
        {visibleSteps.map((entry) => {
          const snapshot = state.steps.find((step) => step.id === entry.id);
          const stepState = snapshot?.state ?? "pending";
          return (
            <div key={entry.id} className={`koma-sync__step koma-sync__step--${stepState}`}>
              <span className="koma-sync__step-marker" aria-hidden="true">
                {stepState === "ok" ? "✓" : stepState === "failed" ? "✕" : stepState === "skipped" ? "—" : stepState === "running" ? <span className="auth-spinner" /> : "○"}
              </span>
              <span className="koma-sync__step-label">{t(entry.labelKey)}</span>
              <span className="koma-sync__step-state">{t(`update.sync.stepState.${stepState}`)}</span>
            </div>
          );
        })}
      </div>

      {state.dirtyFiles.length > 0 && (
        <div className="koma-sync__alert koma-sync__alert--warn" role="alert">
          <strong>{t("update.sync.dirtyTitle")}</strong>
          <p>{t("update.sync.dirtyDesc")}</p>
          <ul className="koma-sync__dirty-list">
            {state.dirtyFiles.slice(0, 10).map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        </div>
      )}

      {state.error && (
        <div className="koma-sync__alert koma-sync__alert--error" role="alert">
          {state.error}
        </div>
      )}

      {state.logLines.length > 0 && (
        <div className="koma-sync__log-wrap">
          <p className="koma-sync__log-title">{t("update.sync.logTitle")}</p>
          <div
            ref={logBoxRef}
            className="koma-sync__log"
            tabIndex={0}
            role="log"
            aria-live="polite"
            aria-label={t("update.sync.logTitle")}
          >
            {state.logLines.map((line, index) => (
              <div key={`${index}:${line}`} className="koma-sync__log-line">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="koma-sync__actions">
        {!sync.supported && <p className="koma-sync__unsupported">{t("update.sync.unsupported")}</p>}
        {sync.supported && sync.running && (
          <button
            type="button"
            onClick={() => void sync.cancel()}
            className="koma-btn koma-btn--ghost koma-btn--sm"
          >
            {t("update.button.cancel")}
          </button>
        )}
        {sync.supported && !sync.running && state.phase === "awaiting-rebuild" && (
          <button
            type="button"
            onClick={() => void sync.rebuildAndRestart()}
            className="koma-btn koma-btn--primary koma-btn--sm"
          >
            {t("update.button.rebuildRestart")}
          </button>
        )}
        {sync.supported && !sync.running && (state.phase === "idle" || state.phase === "failed") && (
          <button
            type="button"
            onClick={() => void sync.start()}
            className="koma-btn koma-btn--primary koma-btn--sm"
          >
            {t("update.button.syncNow")}
          </button>
        )}
      </div>
    </div>
  );
};

export default SyncPanelClassic;
