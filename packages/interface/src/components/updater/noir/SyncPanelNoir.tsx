import { useEffect, useRef } from "react";
import { useUpdaterSync } from "../../../hooks/useUpdaterSync";
import { useI18n } from "../../../i18n";
import { btnPrimary, btnGhost } from "../../system/v2/kit";

// Noir variant of the source-sync control panel ("Control Room" reading:
// steps + monospace log, no decoration beyond the family cut).

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

const STEP_STATE_CLS: Record<string, string> = {
  pending: "text-paper/30",
  running: "text-gold",
  ok: "text-mint",
  failed: "text-crimson",
  skipped: "text-paper/25",
};

export const SyncPanelNoir = () => {
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
    <div role="region" aria-label={t("update.sync.title")}>
      <p className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-paper/50" aria-live="polite">
        <span className={`inline-block h-1.5 w-1.5 ${state.phase === "failed" ? "bg-crimson" : state.phase === "completed" ? "bg-mint" : "bg-gold"}`} />
        {t(PHASE_LABEL_KEYS[state.phase] ?? "update.sync.phase.idle")}
      </p>

      <div className="mt-2">
        {visibleSteps.map((entry) => {
          const snapshot = state.steps.find((step) => step.id === entry.id);
          const stepState = snapshot?.state ?? "pending";
          return (
            <div key={entry.id} className="flex items-center gap-2 border-b border-paper/5 py-1.5 font-mono text-[11px]">
              <span className={`w-4 text-center ${STEP_STATE_CLS[stepState] ?? "text-paper/30"}`} aria-hidden="true">
                {stepState === "ok" ? "✓" : stepState === "failed" ? "✕" : stepState === "skipped" ? "—" : stepState === "running" ? <span className="blink">▼</span> : "○"}
              </span>
              <span className={`flex-1 ${stepState === "failed" ? "text-crimson" : "text-paper/80"}`}>{t(entry.labelKey)}</span>
              <span className={`text-[9px] uppercase tracking-wider ${STEP_STATE_CLS[stepState] ?? "text-paper/30"}`}>
                {t(`update.sync.stepState.${stepState}`)}
              </span>
            </div>
          );
        })}
      </div>

      {state.dirtyFiles.length > 0 && (
        <div className="mt-3 border-l-2 border-gold bg-gold/8 px-3 py-2 font-mono text-[11px] text-gold" role="alert">
          <strong>{t("update.sync.dirtyTitle")}</strong>
          <p className="mt-1 text-paper/60">{t("update.sync.dirtyDesc")}</p>
          <ul className="mt-1 space-y-0.5 text-paper/45">
            {state.dirtyFiles.slice(0, 10).map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        </div>
      )}

      {state.error && (
        <div className="mt-3 border-l-2 border-crimson bg-crimson/8 px-3 py-2 font-mono text-[11px] text-crimson" role="alert">
          {state.error}
        </div>
      )}

      {state.logLines.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.24em] text-paper/40">
            {t("update.sync.logTitle")}
          </p>
          <div
            ref={logBoxRef}
            tabIndex={0}
            role="log"
            aria-live="polite"
            aria-label={t("update.sync.logTitle")}
            className="panel-cut-sm max-h-40 overflow-y-auto border border-paper/8 bg-ink/60 p-2.5 font-mono text-[10px] leading-relaxed text-paper/60"
          >
            {state.logLines.map((line, index) => (
              <div key={`${index}:${line}`} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!sync.supported && (
          <p className="font-mono text-[10px] text-paper/40">{t("update.sync.unsupported")}</p>
        )}
        {sync.supported && sync.running && (
          <button type="button" onClick={() => void sync.cancel()} className={btnGhost}>
            {t("update.button.cancel")}
          </button>
        )}
        {sync.supported && !sync.running && state.phase === "awaiting-rebuild" && (
          <button type="button" onClick={() => void sync.rebuildAndRestart()} className={btnPrimary}>
            {t("update.button.rebuildRestart")}
          </button>
        )}
        {sync.supported && !sync.running && (state.phase === "idle" || state.phase === "failed") && (
          <button type="button" onClick={() => void sync.start()} className={btnPrimary}>
            {t("update.button.syncNow")}
          </button>
        )}
      </div>
    </div>
  );
};

export default SyncPanelNoir;
