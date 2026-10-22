import { motion } from "framer-motion";
import type { ModelProgress } from "../../../models/types";
import { useI18n } from "../../../i18n";

interface ModelProgressBarProps {
  progress: ModelProgress;
  onCancel?: () => void;
  compact?: boolean;
}

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = value, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
};

export const ModelProgressBarNoir = ({ progress, onCancel, compact = false }: ModelProgressBarProps) => {
  const { t } = useI18n();
  // A null percent means the backend does not know the total yet: the bar is
  // indeterminate instead of showing 0.0% of a guessed denominator.
  const percent = progress.percent === null ? null : Math.max(0, Math.min(100, progress.percent));
  const determinate = percent !== null;
  const scale = determinate ? percent / 100 : 1;

  return (
    <div className={`font-mono ${compact ? "space-y-0.5 text-[9px]" : "space-y-1 text-[10px]"}`}>
      <div className="flex items-baseline justify-between">
        <span className="blink font-bold tracking-wider text-crimson">
          ▼ {determinate ? `${percent.toFixed(1)}%` : t("modelManager.progress.unknownTotal")}
        </span>
        <span className="text-paper/50">{formatBytes(progress.speedBytesPerSecond)}/s</span>
      </div>

      <div
        className="panel-cut-sm relative h-2 overflow-hidden border border-paper/10 bg-ink"
        role="progressbar"
        aria-valuenow={determinate ? Math.round(percent) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={determinate ? undefined : t("modelManager.progress.unknownTotal")}
      >
        <motion.div
          className={`stripes-anim h-full w-full origin-left bg-crimson bg-[repeating-linear-gradient(-45deg,rgba(7,7,12,0.3)_0_6px,transparent_6px_12px)] bg-[length:17px_17px] ${determinate ? "" : "animate-pulse"}`}
          initial={false}
          animate={{ scaleX: scale }}
          transition={{ type: "spring", stiffness: 90, damping: 22 }}
        />
      </div>

      <div className="flex items-center justify-between text-paper/50">
        <span>
          {formatBytes(progress.bytesDownloaded)}
          {progress.totalBytes === null ? (
            <span className="text-paper/25"> · {t("modelManager.progress.unknownTotal")}</span>
          ) : (
            <><span className="text-paper/25">/</span> {formatBytes(progress.totalBytes)}</>
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
