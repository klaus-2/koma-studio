import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Zap } from "lucide-react";
import type { UpdaterProgress, UpdaterStatus } from "../../../types";
import { useI18n } from "../../../i18n";
import { StripeBar } from "../../system/v2/kit";

type UpdateTranslationFn = ReturnType<typeof useI18n>["t"];

interface UpdateProgressProps {
  status: UpdaterStatus;
  progress: UpdaterProgress;
  newVersion: string | null;
  hidden?: boolean;
}

const formatBytes = (t: UpdateTranslationFn, value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return `0 ${t("update.units.bytes")}`;
  const units = [t("update.units.bytes"), t("update.units.kilobytes"), t("update.units.megabytes"), t("update.units.gigabytes")];
  let size = value, unit = units[0];
  for (let i = 0; i < units.length; i++) {
    unit = units[i];
    if (size < 1024 || i === units.length - 1) break;
    size /= 1024;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
};
const formatSpeed = (t: UpdateTranslationFn, bps: number): string =>
  `${formatBytes(t, Math.max(0, bps))}${t("update.units.perSecond")}`;

export const UpdateProgressNoir = memo(({ status, progress, newVersion, hidden }: UpdateProgressProps) => {
  const { t } = useI18n();
  const show = !hidden && status === "downloading";

  const rawPercent = progress.percent || 0;
  const transferred = progress.transferred || 0;
  const total = progress.total || 0;
  const effectiveTotal = total > 0 ? total : transferred;
  const percent = effectiveTotal > 0
    ? Math.max(0, Math.min(100, (transferred / effectiveTotal) * 100))
    : Math.max(0, Math.min(100, rawPercent));

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          className="glass panel-cut-sm fixed bottom-5 left-5 z-[125] w-[min(300px,calc(100vw-2rem))] border border-paper/10 p-3.5"
          role="status"
        >
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-paper">
              <span className="blink text-crimson">▼</span> {t("update.progress.title")}
            </p>
            {newVersion && (
              <span className="stamp !px-1.5 !text-[8px]">{t("update.versionPrefix", { version: newVersion })}</span>
            )}
          </div>

          <StripeBar percent={percent} />

          <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] text-paper/50">
            <span className="font-bold text-crimson">{percent.toFixed(1)}%</span>
            <span>{formatBytes(t, progress.transferred)} / {formatBytes(t, progress.total)}</span>
          </div>
          <p className="mt-1 inline-flex items-center gap-1 font-mono text-[9px] text-gold">
            <Zap size={9} fill="currentColor" /> {formatSpeed(t, progress.speed)}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

UpdateProgressNoir.displayName = "UpdateProgressNoir";
export default UpdateProgressNoir;
