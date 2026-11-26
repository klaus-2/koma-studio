import { m } from "framer-motion";
import type { ModelProgress } from "../../../models/types";
import { useI18n } from "../../../i18n";
import {
  formatDownloadBytes,
  formatDownloadEta,
  truncateDownloadFilename,
} from "../progressFormat";

interface ModelProgressBarProps {
  progress: ModelProgress;
  onCancel?: () => void;
  compact?: boolean;
}

export const ModelProgressBarNoir = ({ progress, onCancel, compact = false }: ModelProgressBarProps) => {
  const { t } = useI18n();
  // A null percent means the backend does not know the total yet: the bar is
  // indeterminate instead of showing 0.0% of a guessed denominator.
  const percent = progress.percent === null ? null : Math.max(0, Math.min(100, progress.percent));
  const determinate = percent !== null;
  const scale = determinate ? percent / 100 : 1;
  const etaLabel = determinate ? formatDownloadEta(progress.etaSeconds) : null;
  const hasFileCount =
    typeof progress.filesTotal === "number" && progress.filesTotal > 0;
  const completedCount =
    typeof progress.filesCompleted === "number" && hasFileCount
      ? Math.min(progress.filesCompleted, progress.filesTotal ?? 0)
      : 0;
  const fileLabel = progress.currentFile
    ? truncateDownloadFilename(progress.currentFile, compact ? 18 : 26)
    : null;

  return (
    <div className={`font-mono ${compact ? "space-y-0.5 text-[9px]" : "space-y-1 text-[10px]"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="blink font-bold tracking-wider text-crimson">
            ▼ {determinate ? `${percent.toFixed(1)}%` : t("modelManager.progress.unknownTotal")}
          </span>
          {progress.phase === "verifying" && (
            <span className="truncate text-azure">
              · {t("modelManager.status.verifying")}
            </span>
          )}
          {progress.attempt > 1 && (
            <span className="border border-gold/40 bg-gold/10 px-1 py-0.2 text-[9px] text-gold">
              {t("modelManager.progress.attempt", { count: progress.attempt })}
            </span>
          )}
        </span>
        <span className="shrink-0 text-paper/55">
          {formatDownloadBytes(progress.speedBytesPerSecond)}/s
          {etaLabel ? <span className="text-paper/35"> · ~{etaLabel}</span> : null}
        </span>
      </div>

      <div
        className="panel-cut-sm relative h-2 overflow-hidden border border-paper/10 bg-ink"
        role="progressbar"
        aria-valuenow={determinate ? Math.round(percent) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={determinate ? undefined : t("modelManager.progress.unknownTotal")}
      >
        <m.div
          className={`stripes-anim h-full w-full origin-left bg-crimson bg-[repeating-linear-gradient(-45deg,rgba(7,7,12,0.3)_0_6px,transparent_6px_12px)] bg-[length:17px_17px] ${determinate ? "" : "animate-pulse"}`}
          initial={false}
          animate={{ scaleX: scale }}
          transition={{ type: "spring", stiffness: 90, damping: 22 }}
        />
      </div>

      {(fileLabel || hasFileCount) && (
        <div className="flex items-center justify-between gap-2 text-[9px] text-paper/45">
          <span className="truncate" title={progress.currentFile ?? undefined}>
            {fileLabel ?? ""}
          </span>
          {hasFileCount && (
            <span className="shrink-0 tabular-nums text-paper/40">
              {t("modelManager.progress.files", {
                completed: completedCount,
                total: progress.filesTotal ?? 0,
              })}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-paper/50">
        <span>
          {formatDownloadBytes(progress.bytesDownloaded)}
          {progress.totalBytes === null ? (
            <span className="text-paper/25"> · {t("modelManager.progress.unknownTotal")}</span>
          ) : (
            <><span className="text-paper/25">/</span> {formatDownloadBytes(progress.totalBytes)}</>
          )}
        </span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="uppercase tracking-[0.18em] text-paper/60 underline decoration-crimson/50 underline-offset-2 transition-colors hover:text-crimson"
          >
            {t("common.cancel")}
          </button>
        )}
      </div>
    </div>
  );
};

export default ModelProgressBarNoir;
