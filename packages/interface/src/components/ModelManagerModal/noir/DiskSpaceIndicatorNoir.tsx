import { motion } from "framer-motion";
import { AlertTriangle, HardDrive } from "lucide-react";
import { useI18n } from "../../../i18n";
import { formatBytes } from "../../../models/model-storage";
import type { DiskSpaceInfo } from "../../../models/types";

interface DiskSpaceIndicatorProps {
  diskSpace: DiskSpaceInfo | null;
  installedCount: number;
  totalCount: number;
  installedSizeBytes: number;
}

export const DiskSpaceIndicatorNoir = ({
  diskSpace, installedCount, totalCount, installedSizeBytes,
}: DiskSpaceIndicatorProps) => {
  const { t } = useI18n();
  const usagePercent = diskSpace
    ? ((diskSpace.totalBytes - diskSpace.freeBytes) / diskSpace.totalBytes) * 100
    : 0;
  const isDanger = usagePercent > 90;
  const isWarning = usagePercent > 75 && !isDanger;
  const fillColor = isDanger ? "bg-crimson" : isWarning ? "bg-gold" : "bg-mint";
  const pctColor = isDanger ? "text-crimson" : isWarning ? "text-gold" : "text-mint";

  return (
    <div className="min-w-[220px] flex-1 space-y-1.5">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-paper/50">
        <HardDrive size={12} className="text-azure" />
        <span>
          {t("modelManager.disk.free", { space: diskSpace ? formatBytes(diskSpace.freeBytes) : "—" })}
          <span aria-hidden className="mx-1.5 text-crimson/60">/</span>
          {t("modelManager.disk.models", { installed: installedCount, total: totalCount, size: formatBytes(installedSizeBytes) })}
        </span>
        {diskSpace && <span className={`ml-auto font-bold ${pctColor}`}>{usagePercent.toFixed(0)}%</span>}
      </div>

      {diskSpace ? (
        <div aria-hidden className="panel-cut-sm h-1.5 overflow-hidden border border-paper/10 bg-ink">
          <motion.div
            className={`h-full w-full origin-left ${fillColor}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: usagePercent / 100 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-gold">
          <AlertTriangle size={11} />
          <span>{t("modelManager.disk.notVerified")}</span>
        </div>
      )}
    </div>
  );
};

export default DiskSpaceIndicatorNoir;
