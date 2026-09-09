import { memo } from "react";

import type { UpdaterProgress, UpdaterStatus } from "../../types";
import { useI18n } from "../../i18n";

type UpdateTranslationFn = ReturnType<typeof useI18n>["t"];

interface UpdateProgressProps {
  status: UpdaterStatus;
  progress: UpdaterProgress;
  newVersion: string | null;
  hidden?: boolean;
}

const formatBytes = (
  t: UpdateTranslationFn,
  value: number,
): string => {
  if (!Number.isFinite(value) || value <= 0) return `0 ${t("update.units.bytes")}`;
  const units = [
    t("update.units.bytes"),
    t("update.units.kilobytes"),
    t("update.units.megabytes"),
    t("update.units.gigabytes"),
  ];
  let size = value;
  let unit = units[0];
  for (let i = 0; i < units.length; i++) {
    unit = units[i];
    if (size < 1024 || i === units.length - 1) break;
    size /= 1024;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
};

const formatSpeed = (
  t: UpdateTranslationFn,
  bps: number,
): string => `${formatBytes(t, Math.max(0, bps))}${t("update.units.perSecond")}`;

export const UpdateProgress = memo(({ status, progress, newVersion, hidden }: UpdateProgressProps) => {
  const { t } = useI18n();
  if (hidden || status !== "downloading") return null;

  const rawPercent = progress.percent || 0;
  const transferred = progress.transferred || 0;
  const total = progress.total || 0;
  const effectiveTotal = total > 0 ? total : transferred;
  const percent = effectiveTotal > 0 ? Math.max(0, Math.min(100, (transferred / effectiveTotal) * 100)) : Math.max(0, Math.min(100, rawPercent));

  return (
    <div className="koma-progress-toast">
      <div className="koma-progress-toast__header">
        <div className="koma-progress-toast__title-row">
          <span className="auth-spinner" style={{ width: 14, height: 14 }} />
          <p className="koma-progress-toast__title">{t("update.progress.title")}</p>
        </div>
        {newVersion && (
          <span className="koma-progress-toast__version">
            {t("update.versionPrefix", { version: newVersion })}
          </span>
        )}
      </div>

      <div className="koma-progress-bar">
        <div className="koma-progress-bar__fill" style={{ width: `${percent}%` }} />
      </div>

      <div className="koma-progress-toast__meta">
        <span>{percent.toFixed(1)}%</span>
        <span>
          {formatBytes(t, progress.transferred)} / {formatBytes(t, progress.total)}
        </span>
      </div>

      <p className="koma-progress-toast__speed">
        <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" style={{ opacity: 0.5 }}>
          <path d="M3.75 13.5l7.5-11.25L9 8.25h5.25L6.75 19.5 9 13.5H3.75z" />
        </svg>
        {formatSpeed(t, progress.speed)}
      </p>
    </div>
  );
});

export default UpdateProgress;
